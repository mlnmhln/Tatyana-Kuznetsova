const menuButton = document.querySelector('[data-menu-button]');
const nav = document.querySelector('[data-nav]');
const dialog = document.querySelector('[data-dialog]');
const form = document.querySelector('[data-form]');
const status = document.querySelector('[data-form-status]');
const requestSelect = document.querySelector('[data-request-select]');
const contactInput = form.elements.contact;

const allowedRequests = new Set([
  'Записаться на диагностику',
  'Обсудить мою ситуацию',
  'Записаться к Татьяне',
  'Задать вопрос',
]);

let lastTrigger = null;
let currentRequest = 'Записаться на диагностику';

document.querySelector('[data-year]').textContent = new Date().getFullYear();

const closeMenu = () => {
  menuButton.setAttribute('aria-expanded', 'false');
  nav.classList.remove('open');
};

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  nav.classList.toggle('open', !open);
});

nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

const setRequest = (value) => {
  currentRequest = allowedRequests.has(value) ? value : 'Записаться на диагностику';
  requestSelect.value = currentRequest;
};

requestSelect.addEventListener('change', () => {
  if (allowedRequests.has(requestSelect.value)) currentRequest = requestSelect.value;
});

const isPhoneContact = (value) => /^\s*[+\d]/.test(String(value ?? ''));

const syncContactMode = () => {
  const rawValue = contactInput.value;
  const phoneMode = isPhoneContact(rawValue);
  contactInput.setAttribute('inputmode', phoneMode ? 'tel' : 'text');
  if (!phoneMode) return;

  const hasPlus = rawValue.trimStart().startsWith('+');
  const digits = rawValue.replace(/\D/g, '').slice(0, 11);
  contactInput.value = `${hasPlus ? '+' : ''}${digits}`;
};

contactInput.addEventListener('input', syncContactMode);

const openForm = (trigger) => {
  lastTrigger = trigger;
  setRequest(trigger.dataset.request);
  status.textContent = '';
  status.className = 'form-status';
  closeMenu();
  dialog.showModal();
  document.body.classList.add('dialog-open');
  requestAnimationFrame(() => form.elements.name.focus());
};

document.querySelectorAll('[data-open-form]').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openForm(trigger);
  });
});

document.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => {
  document.body.classList.remove('dialog-open');
  lastTrigger?.focus();
});

document.querySelectorAll('section > *:not(.outcome):not(.result-layout), .support-card').forEach((element) => element.classList.add('reveal'));
const resultList = document.querySelector('.result-list');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (resultList && !reduceMotion) {
  resultList.classList.add('route-sequence');
}
const outcomeBlock = document.querySelector('.outcome');
if (outcomeBlock && !reduceMotion) {
  outcomeBlock.classList.add('outcome-motion');
}
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    entry.target.classList.toggle('in-view', entry.isIntersecting);
  });
}, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

const textRevealGroups = new Map();
const textRevealElements = [...document.querySelectorAll([
  'main h1', 'main h2', 'main h3', 'main p', 'main strong',
  '.process-steps li > span', '.hero-experience span',
  '.site-footer strong', '.site-footer small', '.site-footer p',
  '.footer-nav a', '.footer-meta a',
  '.contact-dialog h2', '.contact-dialog p', '.contact-dialog label',
].join(', '))].filter((element) => (
  !element.classList.contains('reveal')
  && !element.closest('.result-list, .outcome-cards')
  && !element.matches('.button, .secondary-link, .header-cta')
));

textRevealElements.forEach((element) => {
  const group = element.closest('section, footer, dialog') || document.body;
  const order = textRevealGroups.get(group) || 0;
  element.style.setProperty('--text-reveal-delay', `${Math.min(order, 4) * 0.06}s`);
  element.classList.add('text-reveal');
  textRevealGroups.set(group, order + 1);
});

if (reduceMotion) {
  textRevealElements.forEach((element) => element.classList.add('text-in-view'));
} else {
  const textRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('text-in-view', entry.isIntersecting);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -3% 0px' });
  textRevealElements.forEach((element) => textRevealObserver.observe(element));
}

if (resultList?.classList.contains('route-sequence')) {
  const routeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      routeObserver.unobserve(entry.target);
    });
  }, { threshold: 0.22, rootMargin: '0px 0px -12% 0px' });
  routeObserver.observe(resultList);
}

if (outcomeBlock?.classList.contains('outcome-motion')) {
  const outcomeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('in-view', entry.isIntersecting);
    });
  }, { threshold: 0.48, rootMargin: '0px 0px -6% 0px' });
  outcomeObserver.observe(outcomeBlock);
}

const setError = (name, message) => {
  const input = form.elements[name];
  const target = form.querySelector(`[data-error-for="${name}"]`);
  if (input) input.classList.toggle('invalid', Boolean(message));
  if (target) target.textContent = message;
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = '';
  status.className = 'form-status';
  setError('name', '');
  setError('contact', '');

  const data = Object.fromEntries(new FormData(form));
  let valid = true;
  if (!data.name?.trim()) { setError('name', 'Пожалуйста, укажите имя.'); valid = false; }
  if (!data.contact?.trim()) { setError('contact', 'Оставьте удобный контакт для ответа.'); valid = false; }
  else if (isPhoneContact(data.contact)) {
    const phoneDigits = data.contact.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      setError('contact', 'Проверьте номер телефона.');
      valid = false;
    }
  }
  if (!allowedRequests.has(data.request)) {
    status.textContent = 'Не удалось определить задачу обращения. Откройте форму повторно.';
    status.classList.add('error');
    valid = false;
  }
  if (!form.elements.consent.checked) {
    status.textContent = 'Подтвердите согласие на обработку данных.';
    status.classList.add('error');
    valid = false;
  }
  if (!valid) return;

  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.firstChild.textContent = 'Отправляем… ';

  try {
    const isLocal = window.location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocal) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, consent: true }),
      });
      if (!response.ok) throw new Error('request failed');
    }
    form.reset();
    setRequest(currentRequest);
    syncContactMode();
    status.textContent = isLocal ? 'Демо-заявка успешно проверена.' : 'Спасибо! Заявка отправлена. Мы скоро свяжемся с Вами.';
    status.classList.add('success');
  } catch {
    status.textContent = 'Не удалось отправить заявку. Попробуйте еще раз чуть позже.';
    status.classList.add('error');
  } finally {
    submit.disabled = false;
    submit.firstChild.textContent = 'Отправить заявку ';
  }
});
