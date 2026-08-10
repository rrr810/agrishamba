-- ============================================================================
-- SOKOSHAMBA COMPLETE DATABASE SCHEMA
-- ============================================================================

create extension if not exists "uuid-ossp";

-- PROFILES
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  phone text,
  account_type text not null check (account_type in ('farmer', 'buyer', 'supplier', 'rider', 'service', 'admin')),
  county text,
  location text,
  bio text default '',
  avatar_url text default '',
  verified boolean default false,
  rating numeric(3,2) default 5.00,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- RIDER PROFILES
create table if not exists public.rider_profiles (
  id uuid references public.profiles(id) on delete cascade primary key,
  vehicle_type text default 'Boda Boda',
  plate_number text,
  active_county text,
  is_available boolean default true,
  rating numeric(3,2) default 5.00,
  total_deliveries integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.rider_profiles enable row level security;
create policy "Rider profiles viewable by everyone" on public.rider_profiles for select using (true);
create policy "Riders can update own rider profile" on public.rider_profiles for all using (auth.uid() = id);

-- AUTO-CREATE PROFILE TRIGGER
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, phone, account_type, county, location)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'account_type', 'buyer'),
    coalesce(new.raw_user_meta_data->>'county', 'Nairobi'),
    coalesce(new.raw_user_meta_data->>'location', '')
  );

  if (coalesce(new.raw_user_meta_data->>'account_type', '') = 'rider') then
    insert into public.rider_profiles (id, active_county)
    values (new.id, coalesce(new.raw_user_meta_data->>'county', 'Nairobi'));
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- PRODUCTS
create table if not exists public.products (
  id uuid default uuid_generate_v4() primary key,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  category_id text not null,
  name text not null,
  description text,
  price numeric(12,2) not null,
  unit text not null,
  quantity numeric(12,2) not null default 0,
  min_order numeric(12,2) default 1,
  county text not null,
  sub_county text,
  location text,
  delivery_option text default 'Pickup & Rider Delivery',
  contact_preference text default 'WhatsApp & Call',
  emoji text default '🌾',
  status text default 'published' check (status in ('published', 'draft', 'archived', 'out_of_stock')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.products enable row level security;
create policy "Products are viewable by everyone" on public.products for select using (true);
create policy "Sellers can create products" on public.products for insert with check (auth.uid() = seller_id);
create policy "Sellers can update own products" on public.products for update using (auth.uid() = seller_id);
create policy "Sellers can delete own products" on public.products for delete using (auth.uid() = seller_id);

create table if not exists public.product_images (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  url text not null,
  position integer default 0
);
alter table public.product_images enable row level security;
create policy "Product images viewable by everyone" on public.product_images for select using (true);
create policy "Sellers can manage product images" on public.product_images for all using (true);

-- ORDERS & ORDER ITEMS
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  reference text unique not null,
  buyer_id uuid references public.profiles(id) on delete set null,
  seller_id uuid references public.profiles(id) on delete set null,
  subtotal numeric(12,2) not null,
  delivery_fee numeric(12,2) default 0,
  total numeric(12,2) not null,
  payment_method text default 'M-Pesa',
  payment_status text default 'Pending' check (payment_status in ('Pending', 'Paid', 'Failed', 'Cancelled', 'Refunded')),
  status text default 'Pending' check (status in ('Pending', 'Payment Received', 'Confirmed', 'Being Prepared', 'Ready', 'Rider Assigned', 'Out for Delivery', 'Delivered', 'Confirmed by Buyer', 'Cancelled', 'Disputed')),
  address jsonb not null default '{}'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.orders enable row level security;
create policy "Users can view their orders (buyer or seller)" on public.orders for select using (
  auth.uid() = buyer_id or auth.uid() = seller_id or exists (
    select 1 from public.profiles where id = auth.uid() and account_type in ('admin', 'rider')
  )
);
create policy "Buyers can insert orders" on public.orders for insert with check (auth.uid() = buyer_id);
create policy "Participants can update orders" on public.orders for update using (true);

create table if not exists public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  price numeric(12,2) not null,
  qty numeric(12,2) not null,
  unit text not null
);
alter table public.order_items enable row level security;
create policy "Order items viewable by order participants" on public.order_items for select using (true);
create policy "Order items insertable" on public.order_items for insert with check (true);

-- DELIVERY JOBS
create table if not exists public.delivery_jobs (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  rider_id uuid references public.profiles(id) on delete set null,
  status text default 'available' check (status in ('available', 'accepted', 'picked_up', 'out_for_delivery', 'delivered', 'confirmed', 'disputed')),
  vehicle_type text default 'Pickup',
  distance_km numeric(8,2) default 15,
  weight_kg numeric(8,2) default 50,
  fee_total numeric(12,2) default 0,
  rider_earns numeric(12,2) default 0,
  platform_earns numeric(12,2) default 0,
  pickup_county text not null,
  pickup_location text,
  dropoff_county text not null,
  dropoff_location text,
  pickup_at timestamp with time zone,
  delivered_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.delivery_jobs enable row level security;
create policy "Delivery jobs viewable by riders, buyers and sellers" on public.delivery_jobs for select using (true);
create policy "Delivery jobs insertable" on public.delivery_jobs for insert with check (true);
create policy "Riders and system can update delivery jobs" on public.delivery_jobs for update using (true);

-- SERVICES
create table if not exists public.services (
  id uuid default uuid_generate_v4() primary key,
  provider_id uuid references public.profiles(id) on delete cascade not null,
  category text not null,
  name text not null,
  description text,
  price numeric(12,2) not null,
  unit text not null,
  county text not null,
  location text,
  emoji text default '🚜',
  rating numeric(3,2) default 5.00,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.services enable row level security;
create policy "Services viewable by everyone" on public.services for select using (true);
create policy "Providers can manage own services" on public.services for all using (auth.uid() = provider_id);

-- NOTIFICATIONS & REVIEWS
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text default 'system',
  title text not null,
  body text not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.notifications enable row level security;
create policy "Users view own notifications" on public.notifications for all using (auth.uid() = user_id);

create table if not exists public.reviews (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade,
  subject_id uuid references public.profiles(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  rating integer check (rating between 1 and 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.reviews enable row level security;
create policy "Reviews viewable by all" on public.reviews for select using (true);
create policy "Authenticated users can create reviews" on public.reviews for insert with check (auth.uid() = reviewer_id);

-- PAYMENTS
create table if not exists public.payments (
  id uuid default uuid_generate_v4() primary key,
  order_id text not null,
  reference text unique not null,
  amount numeric(12,2) not null,
  status text default 'pending',
  channel text default 'mpesa',
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.payments enable row level security;
create policy "Payments viewable by all authenticated" on public.payments for all using (true);

-- STORAGE BUCKETS
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

create policy "Public Access for Product Images" on storage.objects for select using (bucket_id = 'product-images');
create policy "Authenticated uploads for Product Images" on storage.objects for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
create policy "Public Access for Avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Authenticated uploads for Avatars" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');