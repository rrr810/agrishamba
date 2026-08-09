/**
 * app.js â€” Global bootstrap for every page.
 * Mounts header/footer, floating widgets, delegated actions,
 * and keeps badges in sync with state changes.
 */
import { isDemo } from './config.js';
import { store } from './state.js';
import { auth } from './auth.js';
import { cart } from './cart.js';
import { notificationsService } from './api.js';
import {
  renderHeader, renderFooter, refreshHeaderBadges, toast, confirmDialog,
  installImageFallback, renderNotifPanel, renderWhatsAppButton, qs, page
} from './ui.js';

function boot() {
  const activeKey = document.body.dataset.nav || '';
  renderHeader(activeKey);
  renderFooter();
  installImageFallback();
  renderWhatsAppButton();

  // Shamba AI assistant â€” mounts the floating chat bubble (bottom-left).

  document.addEventListener('click', onGlobalClick);
  markActiveDashLinks();

  // Re-render header when the signed-in user changes; refresh badges on any change.
  store.subscribe((event) => {
    if (event === 'user') renderHeader(document.body.dataset.nav || '');
    refreshHeaderBadges();
  });

  // Restore the Supabase session (no-op in demo mode), then pull notifications.
  auth.hydrate().then(() => {
    if (!isDemo() && auth.isAuthenticated()) {
      notificationsService.list().catch((err) => console.warn('[notifications]', err));
    }
  });
}

function markActiveDashLinks() {
  const file = location.pathname.split('/').pop();
  document.querySelectorAll('.dash-nav a').forEach((a) => {
    if (a.getAttribute('href')?.split('/').pop().split('?')[0] === file) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
}

async function onGlobalClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;

  switch (action) {
    case 'add-to-cart': {
      const product = store.getProduct(id);
      const qtyInput = document.getElementById('qtyInput');
      const qty = qtyInput ? Math.max(1, Number(qtyInput.value) || 1) : 1;
      const res = cart.add(product, qty);
      toast(res.message, res.ok ? 'success' : 'error');
      if (res.ok) refreshHeaderBadges();
      break;
    }
    case 'toggle-fav': {
      if (!auth.isAuthenticated()) {
        toast('Sign in to save products to your account.', 'info', 'Sign in required');
      }
      const now = store.toggleFavorite(id);
      el.classList.toggle('is-active', now);
      el.textContent = now ? 'â™¥' : 'â™¡';
      el.setAttribute('aria-pressed', String(now));
      el.setAttribute('aria-label', now ? 'Remove from saved products' : 'Save product');
      toast(now ? 'Saved to your products.' : 'Removed from saved products.', 'success');
      break;
    }
    case 'logout': {
      // Stop the dropdown's click handler from swallowing the confirm dialog.
      e.stopPropagation();
      document.querySelectorAll('.dropdown__panel').forEach((p) => { p.hidden = true; });
      document.querySelectorAll('[aria-haspopup="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      await new Promise((r) => setTimeout(r, 50));

      const yes = await confirmDialog({
        title: 'Log out of SokoShamba?',
        message: 'You will be returned to the login page. Your cart stays saved on this device.',
        confirmLabel: 'Yes, log out',
        danger: true
      });
      if (!yes) return;

      const { error } = await auth.logout();
      if (error) return toast(error.message || 'Could not log out. Try again.', 'error');

      toast('You have been logged out. Karibu tena! ðŸ‘‹', 'success');
      setTimeout(() => { location.href = page('login.html'); }, 800);
      break;
    }
    case 'mark-all-read': {
      await notificationsService.markAllRead();
      refreshHeaderBadges();
      const panel = qs('#notifPanel');
      if (panel && !panel.hidden) renderNotifPanel(panel);
      toast('All notifications marked as read.', 'success');
      break;
    }
    case 'read-notification': {
      await notificationsService.markRead(id);
      refreshHeaderBadges();
      location.href = page('notifications.html');
      break;
    }
    case 'coming-soon': {
      toast(el.dataset.message || 'This feature connects to the backend and is coming soon.', 'info', 'Coming soon');
      break;
    }
    default: break;
  }
}

document.addEventListener('DOMContentLoaded', boot);
export { boot };

