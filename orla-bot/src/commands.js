// Comandos /orla da guilda (usados pelo script de registro e pela rota /admin/commands do worker).
export const commands = [{
  name: 'orla', description: 'Comandos do bot Orla', type: 1,
  options: [
    { type: 1, name: 'grade', description: 'Configura uma atividade do clã', options: [
      { type: 3, name: 'atividade', description: 'Escolha uma sugestão ou digite um título livre (até 80 caracteres)', required: true, autocomplete: true, min_length: 1, max_length: 80 },
      { type: 4, name: 'integrantes', description: 'Escolha 3, 4, 6 ou 12 integrantes', choices: [3, 4, 6, 12].map(n => ({ name: String(n), value: n })) },
      { type: 3, name: 'inicio', description: 'Use o formato DD/mm/YY HH:MM', min_length: 1, max_length: 40 },
      { type: 3, name: 'descricao', description: 'Informações adicionais (até 250 caracteres)', max_length: 250 },
      { type: 4, name: 'novatos', description: 'Quantidade máxima de novatos titulares (opcional)', min_value: 0, max_value: 99 },
    ] },
    { type: 1, name: 'agenda', description: 'Mostra as grades marcadas do clã' },
    { type: 1, name: 'registrar', description: 'Vincula seu Bungie Name à sua conta Discord', options: [
      { type: 3, name: 'player_bungie_id', description: 'Seu Bungie Name completo, no formato Nome#1234', required: true, min_length: 6, max_length: 30 },
    ] },
  ],
}];
