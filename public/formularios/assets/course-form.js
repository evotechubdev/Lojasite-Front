import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import { addDoc, collection, getFirestore, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { firebaseConfig, FORM_COLLECTION } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const database = getFirestore(app);
const form = document.querySelector('#course-form');
const feedback = document.querySelector('#feedback');
const submit = form.querySelector('button[type="submit"]');
const labels = { frontend: 'Frontend — 1 dia com site publicado', frontend_firebase: 'Frontend + Banco de dados Firebase — 1 dia com site publicado' };
const prices = { frontend: 100, frontend_firebase: 200 };

function formatWhatsapp(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

document.querySelector('#whatsapp').addEventListener('input', event => { event.target.value = formatWhatsapp(event.target.value); });
document.querySelectorAll('[data-pick]').forEach(button => button.addEventListener('click', () => {
  const option = document.querySelector(`input[value="${button.dataset.pick}"]`);
  option.checked = true;
  document.querySelector('#inscricao').scrollIntoView({ behavior: 'smooth' });
}));

form.addEventListener('submit', async event => {
  event.preventDefault();
  feedback.className = 'feedback';
  const data = new FormData(form);
  const fullName = String(data.get('fullName') || '').trim().replace(/\s+/g, ' ');
  const whatsapp = String(data.get('whatsapp') || '').replace(/\D/g, '');
  const course = String(data.get('course') || '');
  if (fullName.length < 3 || whatsapp.length < 10 || !prices[course]) {
    feedback.textContent = 'Confira seu nome, WhatsApp com DDD e a opção de aula.';
    feedback.className = 'feedback error show';
    return;
  }
  submit.disabled = true;
  submit.textContent = 'Enviando com segurança...';
  try {
    await addDoc(collection(database, FORM_COLLECTION), {
      nomeCompleto: fullName,
      whatsapp,
      cursoId: course,
      cursoNome: labels[course],
      valor: prices[course],
      origem: 'tiktok',
      formularioId: 'crie-seu-site-em-1-dia',
      status: 'novo',
      criadoEm: serverTimestamp()
    });
    document.querySelector('#form-content').classList.add('hidden');
    document.querySelector('#success').classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    console.error('Falha ao enviar inscrição:', error.code || error.message);
    feedback.textContent = 'Não foi possível enviar agora. Verifique sua internet e tente novamente.';
    feedback.className = 'feedback error show';
  } finally {
    submit.disabled = false;
    submit.textContent = 'Quero reservar minha aula';
  }
});
