import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { APP } from '../config';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEntrando(false);
    if (error) {
      setErro(
        error.message.includes('Invalid login')
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar. Tente novamente.',
      );
    }
  }

  return (
    <div className="login">
      <section className="login-apresentacao">
        <img className="login-marca" src={APP.logo} alt={APP.nome} />
        <h1>
          Seus aluguéis,
          <br />
          <em>organizados.</em>
        </h1>
        <p>Inquilinos, contratos, documentos, cobranças e chamados em um só lugar.</p>
        <ul>
          <li>Aviso de contrato vencendo e de reajuste anual</li>
          <li>Cálculo de multa e juros por atraso</li>
          <li>Reajuste pelo IGP-M ou IPCA do Banco Central</li>
          <li>Quadro de solicitações dos inquilinos</li>
          <li>Portal para o inquilino acompanhar o contrato</li>
        </ul>
      </section>

      <section className="login-formulario">
        <form className="cartao" onSubmit={entrar}>
          <h2>Entrar</h2>
          <p className="texto-suave">Anfitriões e inquilinos entram por aqui. O sistema reconhece o seu tipo de acesso.</p>

          <label className="campo">
            <span className="campo-rotulo">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>

          <label className="campo">
            <span className="campo-rotulo">Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {erro && <p className="erro-formulario">{erro}</p>}

          <button className="botao botao-primario botao-cheio" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </div>
  );
}
