/**
 * Static institutional context (UFAM Resolucao 023/2017), exposed to the AI
 * assistant as an MCP resource by academic-mcp.server.ts. Lives in this
 * module — not in workers/ai — because it's UFAM domain knowledge, same as
 * the academic MCP tools; the AI worker only fetches and relays it, it
 * never owns institutional rules content.
 */
export const UFAM_ACADEMIC_RULES = `
Contexto: UFAM = Universidade Federal do Amazonas. eCampus = portal academico oficial da UFAM (fonte real de notas, faltas, horarios e planos de ensino). Meu Campus = este aplicativo nao oficial, que sincroniza dados do eCampus para o aluno. As regras abaixo (Resolucao 023/2017) sao a fonte de verdade institucional para calculos e explicacoes — nunca as substitua por suposicao generica, e nunca aplique numeros do aluno que nao vieram de uma tool.

Regras academicas da UFAM (Resolucao 023/2017) que voce deve usar para calculos e explicacoes:

1. Regras de notas (Media Final)
- Formula: MF = (2 x MEE + PF) / 3, onde MEE e a Media das Etapas de Estudo e PF e a Prova Final.
- Aprovado se MF >= 5,0 e frequencia >= 75%.
- Se MEE >= 8,0 e a frequencia ja atingiu 75% de presenca, o aluno fica dispensado da PF (mas pode fazer se quiser).
- Para saber a nota minima necessaria na PF a partir da MEE, resolva: PF >= (5,0 x 3) - (2 x MEE) = 15 - 2 x MEE. Nunca responda com "nao sei calcular" — sempre faca a conta com os dados reais do aluno.
  Exemplos:
  - MEE = 6,0 -> precisa de PF >= 3,0.
  - MEE = 4,0 -> precisa de PF >= 7,0.
  - MEE = 8,5 -> dispensado da PF.
  - MEE = 3,0, e uma substitutiva troca uma nota 0 por 6,0, elevando a MEE para 5,0 -> precisa de PF >= 5,0.

2. Regras de frequencia (faltas)
- Limite maximo: 25% de faltas por disciplina.
- Faltas maximas permitidas = carga horaria da disciplina x 0,25, arredondado para baixo.
  Exemplos:
  - Disciplina de 60h -> maximo de 15 horas de falta.
  - Disciplina de 45h -> maximo de 11 horas de falta.
- Se o aluno ultrapassar 25% de faltas, ele e reprovado por frequencia mesmo com nota alta — sempre avise isso quando o risco for real.

3. Regras de trancamento
- Trancamento de disciplina individual: permitido a partir do 3o periodo do curso.
- Trancamento total do curso: permitido por no maximo 2 semestres.
- Nao e permitido trancar se isso deixar o aluno abaixo do minimo de creditos exigido no periodo.

Exemplos de como responder usando essas regras:
- Pergunta: "Tirei 6.5, 2.5 e 0. Preciso de quanto na PF?" -> Calcule a MEE com os pesos reais das avaliacoes retornadas pelas tools, depois aplique PF >= 15 - 2 x MEE. Resposta no formato: "Sua MEE esta em 3,0. Voce precisa tirar pelo menos 9,0 na Prova Final."
- Pergunta: "Quantas faltas posso ter em Calculo?" -> Busque a carga horaria real da disciplina via tools e calcule 25% dela. Resposta no formato: "Essa disciplina tem 60 horas. Voce pode faltar no maximo 15 horas (25%)."
`.trim();
