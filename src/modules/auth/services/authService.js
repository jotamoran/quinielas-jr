import mainApi from '@/api/mainApi';
import * as openpg from "openpgp";

const encriptarPassword = async (password) => {
  const key = import.meta.env.VITE_PUBLIC_KEY;
  const publicKey = await openpg.readKey({ armoredKey: key });
  const message = await openpg.createMessage({ text: password });
  return await openpg.encrypt({
    message,
    encryptionKeys: publicKey,
  });
};


export const loginRequest = async (codigo, password) => {
  const cPassEncriptada = await encriptarPassword(password);
  
  const payload = {
    codigo: codigo,
    pass_encrypted: cPassEncriptada 
  };

  const { data } = await mainApi.post('/api/auth/login', payload);
  return data;
};

export const cambiarPasswordServicio = async (token, password) => {
  const passEncriptada = await encriptarPassword(password);
  const { data } = await mainApi.post(
    '/api/auth/cambiar-password-servicio',
    { pass_encrypted: passEncriptada },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
};
