import { CommunityFeedData } from "@/services/types";

export const DEMO_COMMUNITY_FEED: CommunityFeedData = {
  tabs: ["Feed", "Treinos", "Eventos", "Resultados"],
  posts: [
    {
      id: "post-ritmo-sabado",
      tab: "Treinos",
      author: "Ventu Suli Oficial",
      avatarInitials: "VS",
      role: "ORGANIZER",
      timeAgo: "2h",
      content:
        "Treino de ritmo confirmado para sabado, 6h no Parque da Luz. Vamos fazer blocos progressivos de 6 km com fechamento forte.",
      image: {
        title: "Treino coletivo - sabado 6h",
        subtitle: "Parque da Luz",
        tone: "ocean",
      },
      reactions: [
        { type: "LIKE", count: 126, activeByDefault: true },
        { type: "FIRE", count: 34 },
        { type: "APPLAUSE", count: 19 },
      ],
      comments: [
        {
          id: "comment-ritmo-1",
          author: "Ana Ribeiro",
          avatarInitials: "AR",
          role: "ATHLETE",
          timeAgo: "1h",
          text: "Confirmada! Vou focar em manter pace constante no segundo bloco.",
        },
        {
          id: "comment-ritmo-2",
          author: "Coach Bruno",
          avatarInitials: "CB",
          role: "COACH",
          timeAgo: "48m",
          text: "Perfeito. Quem for iniciante pode fazer 4 km com o grupo B.",
        },
      ],
      ctaLabel: "Participar do treino",
    },
    {
      id: "post-ponte-kits",
      tab: "Eventos",
      author: "Equipe de Provas",
      avatarInitials: "EP",
      role: "ORGANIZER",
      timeAgo: "5h",
      content:
        "Entrega de kits da Corrida da Ponte Hercilio Luz inicia sexta, das 10h as 20h. Levar documento com foto para retirada.",
      image: {
        title: "Entrega de kits",
        subtitle: "Sexta e sabado",
        tone: "sunset",
      },
      reactions: [
        { type: "LIKE", count: 88 },
        { type: "FIRE", count: 9 },
        { type: "APPLAUSE", count: 27 },
      ],
      comments: [
        {
          id: "comment-kits-1",
          author: "Joao Silva",
          avatarInitials: "JS",
          role: "ATHLETE",
          timeAgo: "3h",
          text: "Tem opcao de retirada por terceiro com autorizacao?",
        },
      ],
      ctaLabel: "Ver detalhes da prova",
    },
    {
      id: "post-pr-21k",
      tab: "Resultados",
      author: "Marina Costa",
      avatarInitials: "MC",
      role: "ATHLETE",
      timeAgo: "Ontem",
      content:
        "Bati meu PR nos 21K: 1h38! Obrigada ao grupo e a equipe tecnica. Proxima meta e baixar para 1h35 no proximo ciclo.",
      reactions: [
        { type: "LIKE", count: 164 },
        { type: "FIRE", count: 71, activeByDefault: true },
        { type: "APPLAUSE", count: 54 },
      ],
      comments: [
        {
          id: "comment-pr-1",
          author: "Ventu Suli Oficial",
          avatarInitials: "VS",
          role: "ORGANIZER",
          timeAgo: "20h",
          text: "Evolucao excelente. Vamos ajustar o bloco de limiar para buscar 1h35.",
        },
        {
          id: "comment-pr-2",
          author: "Pedro Almeida",
          avatarInitials: "PA",
          role: "ATHLETE",
          timeAgo: "18h",
          text: "Parabens! Ritmo muito consistente do km 10 ao 18.",
        },
      ],
      ctaLabel: "Comentar",
    },
  ],
};
