/** sell.js — create / edit / delete listings with image previews and drafts. */
import { products } from '../api.js';
import { store } from '../state.js';
import { CATEGORIES, COUNTIES, UNITS } from '../config.js';
import { rules, validateForm, liveValidate } from '../validation.js';
import { qs, toast, escapeHtml, formatKES, emptyState, setButtonLoading, confirmDialog, getParam, requireAuth } from '../ui.js';

const { requireRole } = await import('../guards.js');
// Only farmers, suppliers and admins can publish product listings.
const user = await requireRole(['farmer', 'supplier'], { mount: '#main' });
if (user) {
  const form = qs('#sellForm');
  let images = [];
  let editingId = getParam('edit');

  /* ---------------------------------------------------------- selects */
  qs('#category').insertAdjacentHTML('beforeend', CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join(''));
  qs('#unit').insertAdjacentHTML('beforeend', UNITS.map((u) => `<option>${u}</option>`).join(''));
  qs('#county').insertAdjacentHTML('beforeend', COUNTIES.map((c) => `<option>${c}</option>`).join(''));
  if (user.county) qs('#county').value = user.county;

  /* ------------------------------------------------------- description */
  const desc = qs('#description');
  desc.addEventListener('input', () => {
    if (desc.value.length > 600) desc.value = desc.value.slice(0, 600);
    qs('#descCount').textContent = desc.value.length;
  });

  /* ------------------------------------------------------------ images */
  const fileInput = qs('#images');
  const dropZone = qs('#dropZone');
  const thumbs = qs('#thumbs');

  const drawThumbs = () => {
    thumbs.innerHTML = images.map((src, i) => `
      <div class="thumb"><img src="${src}" alt="Product image ${i + 1} preview">
      <button type="button" data-remove-img="${i}" aria-label="Remove image ${i + 1}">✕</button></div>`).join('');
  };

  const addFiles = (files) => {
    [...files].forEach((file) => {
      if (images.length >= 5) return toast('You can upload up to 5 images.', 'warn');
      if (!file.type.startsWith('image/')) return toast(`${file.name} is not an image.`, 'error');
      if (file.size > 3 * 1024 * 1024) return toast(`${file.name} is larger than 3MB.`, 'error');
      const reader = new FileReader();
      reader.onload = () => { images.push(reader.result); drawThumbs(); };
      reader.readAsDataURL(file);
    });
  };

  fileInput.addEventListener('change', (e) => addFiles(e.target.files));
  ['dragenter', 'dragover'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  thumbs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-img]');
    if (!btn) return;
    images.splice(Number(btn.dataset.removeImg), 1);
    drawThumbs();
    toast('Image removed.', 'success');
  });

  /* -------------------------------------------------------- validation */
  const schema = {
    name: [rules.required, rules.minLen(4)],
    category: [rules.required],
    unit: [rules.required],
    description: [rules.required, rules.minLen(30)],
    price: [rules.required, rules.positive],
    quantity: [rules.required, rules.positive],
    county: [rules.required],
    location: [rules.required],
    delivery: [rules.required],
    contact: [rules.required]
  };
  liveValidate(form, schema);

  const collect = (values) => ({
    name: values.name.trim(),
    category: values.category,
    description: values.description.trim(),
    price: Number(values.price),
    unit: values.unit,
    quantity: Number(values.quantity),
    county: values.county,
    subCounty: values.subCounty,
    location: values.location.trim(),
    delivery: values.delivery,
    contactPreference: values.contact,
    images: images.length ? images : [''],
    emoji: CATEGORIES.find((c) => c.id === values.category)?.icon || '🌿'
  });

  /* ------------------------------------------------------------ submit */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { valid, values } = validateForm(form, schema);
    if (!valid) return toast('Please fix the highlighted fields.', 'error');
    const btn = form.querySelector('button[type="submit"]');
    setButtonLoading(btn, true, editingId ? 'Saving…' : 'Publishing…');
    const payload = collect(values);
    const res = editingId ? await products.update(editingId, payload) : await products.create(payload);
    setButtonLoading(btn, false);
    if (res.error) return toast(res.error.message, 'error');
    store.pushNotification({ type: 'listing', title: editingId ? 'Listing updated' : 'Listing published', body: `${payload.name} is live on the marketplace.` });
    toast(editingId ? 'Listing updated successfully.' : 'Listing published successfully.', 'success');
    qs('#formAlert').innerHTML = `<div class="alert alert--success"><span>✅</span><div><strong>${escapeHtml(payload.name)}</strong> is live.
      <a href="product.html?id=${encodeURIComponent(res.data.id)}">View listing</a></div></div>`;
    form.reset(); images = []; drawThumbs(); editingId = null;
    qs('#pageTitle').textContent = 'List a product';
    drawListings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ------------------------------------------------------------ drafts */
  qs('#saveDraft').addEventListener('click', () => {
    const values = {};
    new FormData(form).forEach((v, k) => { values[k] = v; });
    if (!values.name) return toast('Add at least a product name before saving a draft.', 'warn');
    store.saveDraft({ id: 'draft-' + Date.now(), savedAt: new Date().toISOString(), values, images });
    toast('Draft saved on this device.', 'success');
    drawDrafts();
  });

  function drawDrafts() {
    const list = store.getDrafts();
    qs('#draftList').innerHTML = list.length ? list.map((d) => `
      <div class="list-row">
        <div class="list-row__main"><strong>${escapeHtml(d.values.name || 'Untitled draft')}</strong>
          <small>Saved ${new Date(d.savedAt).toLocaleString('en-KE')}</small></div>
        <div class="flex gap-2">
          <button class="btn btn--outline btn--sm" data-load-draft="${d.id}">Load</button>
          <button class="btn btn--ghost btn--sm" data-del-draft="${d.id}" style="color:var(--danger-600)">✕</button>
        </div>
      </div>`).join('') : '<p class="small muted">No saved drafts. Use “Save as draft” to keep a listing for later.</p>';
  }

  qs('#draftList').addEventListener('click', async (e) => {
    const load = e.target.closest('[data-load-draft]'), del = e.target.closest('[data-del-draft]');
    if (load) {
      const draft = store.getDrafts().find((d) => d.id === load.dataset.loadDraft);
      Object.entries(draft.values).forEach(([k, v]) => { if (form.elements[k]) form.elements[k].value = v; });
      images = draft.images || []; drawThumbs();
      qs('#descCount').textContent = (draft.values.description || '').length;
      toast('Draft loaded into the form.', 'success');
      window.scrollTo({ top: 200, behavior: 'smooth' });
    }
    if (del) {
      const yes = await confirmDialog({ title: 'Delete draft', message: 'Remove this saved draft?', confirmLabel: 'Delete', danger: true });
      if (yes) { store.deleteDraft(del.dataset.delDraft); drawDrafts(); toast('Draft deleted.', 'success'); }
    }
  });

  /* -------------------------------------------------------- my listings */
  async function drawListings() {
    const { data } = await products.mine();
    const mount = qs('#myListings');
    if (!data.length) {
      mount.innerHTML = '<p class="small muted">You have no live listings yet. Publish your first product using the form.</p>';
      return;
    }
    mount.innerHTML = data.map((p) => `
      <div class="list-row">
        <img class="list-row__img" src="${p.images?.[0] || ''}" alt="" loading="lazy" data-emoji="${p.emoji || '🌿'}" data-label="${escapeHtml(p.name)}">
        <div class="list-row__main"><strong>${escapeHtml(p.name)}</strong>
          <small>${formatKES(p.price)} / ${escapeHtml(p.unit)} · ${p.quantity} left</small></div>
        <div class="flex gap-2">
          <button class="btn btn--outline btn--sm" data-edit="${p.id}">Edit</button>
          <button class="btn btn--ghost btn--sm" data-delete="${p.id}" style="color:var(--danger-600)">Delete</button>
        </div>
      </div>`).join('');
  }

  qs('#myListings').addEventListener('click', async (e) => {
    const edit = e.target.closest('[data-edit]'), del = e.target.closest('[data-delete]');
    if (edit) {
      const p = store.getProduct(edit.dataset.edit);
      editingId = p.id;
      form.elements.name.value = p.name; form.elements.category.value = p.category;
      form.elements.unit.value = p.unit; form.elements.description.value = p.description;
      form.elements.price.value = p.price; form.elements.quantity.value = p.quantity;
      form.elements.county.value = p.county; form.elements.subCounty.value = p.subCounty || '';
      form.elements.location.value = p.location; form.elements.delivery.value = p.delivery;
      form.elements.contact.value = p.contactPreference || 'In-platform messages';
      images = (p.images || []).filter(Boolean); drawThumbs();
      qs('#pageTitle').textContent = 'Edit listing';
      qs('#descCount').textContent = p.description.length;
      toast('Listing loaded for editing.', 'info');
      window.scrollTo({ top: 200, behavior: 'smooth' });
    }
    if (del) {
      const yes = await confirmDialog({ title: 'Delete listing', message: 'This removes the product from the marketplace. Continue?', confirmLabel: 'Delete listing', danger: true });
      if (!yes) return;
      await products.remove(del.dataset.delete);
      toast('Listing deleted.', 'success');
      drawListings();
    }
  });

  qs('#resetForm').addEventListener('click', () => {
    images = []; drawThumbs(); editingId = null;
    qs('#pageTitle').textContent = 'List a product';
    qs('#descCount').textContent = '0';
    qs('#formAlert').innerHTML = '';
  });

  drawDrafts();
  drawListings();
  if (editingId) qs('#myListings').querySelector(`[data-edit="${editingId}"]`)?.click();
}
