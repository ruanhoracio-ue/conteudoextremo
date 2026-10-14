import { VideosCurtosTab } from './VideosCurtosTab'

// Vídeos do Tiago: mesmo fluxo e colunas dos Vídeos Curtos, em tabela própria
// (videos_tiago no Supabase), com preferências e anexos separados.
const CONFIG_VIDEOS_TIAGO = {
  collection: 'videosTiago',
  scope: 'videos-tiago',
  tipo: 'Vídeo Tiago',
  novo: 'Novo Vídeo',
  csv: 'videos-tiago',
  attachmentsType: 'videosTiago',
}

export function VideosTiagoTab(props) {
  return <VideosCurtosTab {...props} config={CONFIG_VIDEOS_TIAGO} />
}
