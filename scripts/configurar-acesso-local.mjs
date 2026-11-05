/** Cria um acesso somente para seu ambiente local, sem guardar a senha em texto. */
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { createInterface, emitKeypressEvents } from 'node:readline';
import { fileURLToPath } from 'node:url';

const destino = fileURLToPath(new URL('../.dev.vars', import.meta.url));
if (existsSync(destino)) throw new Error('.dev.vars já existe. Nada foi sobrescrito.');
if (!process.stdin.isTTY) throw new Error('Execute este comando em um terminal interativo.');
const terminal = createInterface({ input: process.stdin, output: process.stdout });
const usuario = await new Promise((resolve) => terminal.question('Usuário local: ', resolve));
terminal.close();
if (!/^[a-zA-Z0-9._-]{3,64}$/.test(usuario))
  throw new Error('Use de 3 a 64 letras, números, pontos, traços ou sublinhados.');

// O terminal mostra apenas pontos. A senha original não é gravada no arquivo.
emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdout.write('Senha local (mínimo 12 caracteres): ');
const senha = await new Promise((resolve, reject) => {
  let texto = '';
  const tecla = (caractere, key) => {
    if (key?.ctrl && key.name === 'c') {
      limpar();
      reject(new Error('Cancelado.'));
      return;
    }
    if (key?.name === 'return') {
      limpar();
      resolve(texto);
      return;
    }
    if (key?.name === 'backspace') {
      if (texto.length) {
        texto = texto.slice(0, -1);
        process.stdout.write('\b \b');
      }
      return;
    }
    if (caractere && !key?.ctrl && !key?.meta) {
      texto += caractere;
      process.stdout.write('•');
    }
  };
  const limpar = () => {
    process.stdin.off('keypress', tecla);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write('\n');
  };
  process.stdin.on('keypress', tecla);
});
if (senha.length < 12) throw new Error('A senha precisa ter pelo menos 12 caracteres.');
// O mesmo algoritmo e parâmetros de lib/orders-api.ts.
const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(senha, salt, 100000, 32, 'sha256').toString('hex');
writeFileSync(
  destino,
  `CHICO_ADMIN_USER="${usuario}"\nCHICO_ADMIN_PASSWORD_HASH="${salt}:${hash}"\n`,
  { flag: 'wx' },
);
console.log('Acesso local configurado em .dev.vars. Esse arquivo não deve ser compartilhado.');
