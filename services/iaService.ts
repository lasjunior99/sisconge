/**
 * Serviço de IA (Gemini)
 * Comunicação exclusiva com o backend (/api/analise-ia)
 * A chave da API nunca fica no front-end
 */

export async function analisarComIA(prompt: string): Promise<string> {
  const resposta = await fetch('/api/analise-ia', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  });

  if (!resposta.ok) {
    throw new Error('Falha ao comunicar com a IA');
  }

  const data = await resposta.json();
  return data.resposta || 'Sem resposta da IA';
}
