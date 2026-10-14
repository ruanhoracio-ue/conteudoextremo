let _id = 100

function id() {
  return String(++_id)
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function futureStr(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function pastStr(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

export const seedData = {
  videosLongos: [],
  videosCurtos: [],
  videosTiago: [],
  cortes: [],
  frases: [],
  equipe: [
    { id: id(), nome: 'João Silva', email: 'joao@conversaoextrema.com', cargo: 'Admin', status: 'ativo', createdAt: daysAgo(30) },
    { id: id(), nome: 'Maria Santos', email: 'maria@conversaoextrema.com', cargo: 'Editor', status: 'ativo', createdAt: daysAgo(25) },
    { id: id(), nome: 'Carlos Lima', email: 'carlos@conversaoextrema.com', cargo: 'Editor', status: 'pendente', createdAt: daysAgo(2) },
    { id: id(), nome: 'Ana Oliveira', email: 'ana@conversaoextrema.com', cargo: 'Viewer', status: 'ativo', createdAt: daysAgo(15) },
  ],
  calendario: [],
  producao: [],
}