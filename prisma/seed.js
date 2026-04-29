const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const {
  PrismaClient,
  EventStatus,
  RegistrationStatus,
  PaymentStatus,
  UserRole,
  OrgPlan,
  SportLevel,
} = require("@prisma/client");

const prisma = new PrismaClient();

const ORG_SLUG = "assessoria-ventu-demo";
const PLATFORM_ORG_SLUG = "ventusuli-platform";
const DEFAULT_PASSWORD = "Demo@1234";
const ATHLETE_DEMO_PASSWORD = "Atleta@1234";
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "superadmin@ventu.demo";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin@1234";
const EFI_PIX_KEY = "financeiro@ventusuli.demo";
const DEMO_INVITE_TOKEN = "VENTU-ATLETA-2026";
const DEMO_SEED_ENABLED = process.env.DEMO_SEED_ENABLED === "true";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const USERS = [
  { email: "admin@ventu.demo", role: UserRole.ADMIN, name: "Carla Menezes" },
  { email: "coach@ventu.demo", role: UserRole.COACH, name: "Rafael Torres" },
  { email: "atleta@ventu.demo", role: UserRole.ATHLETE, name: "Marina Oliveira" },
  { email: "lucas@ventu.demo", role: UserRole.ATHLETE, name: "Lucas Andrade" },
  { email: "ana@ventu.demo", role: UserRole.ATHLETE, name: "Ana Beatriz" },
  { email: "thiago@ventu.demo", role: UserRole.ATHLETE, name: "Thiago Mendes" },
  { email: "paula@ventu.demo", role: UserRole.ATHLETE, name: "Paula Ferreira" },
  { email: "bruno@ventu.demo", role: UserRole.ATHLETE, name: "Bruno Lima" },
  { email: "juliana@ventu.demo", role: UserRole.ATHLETE, name: "Juliana Prado" },
  { email: "renato@ventu.demo", role: UserRole.ATHLETE, name: "Renato Souza" },
  { email: "camila@ventu.demo", role: UserRole.ATHLETE, name: "Camila Costa" },
  { email: "danilo@ventu.demo", role: UserRole.ATHLETE, name: "Danilo Vieira" },
  { email: "fernanda@ventu.demo", role: UserRole.ATHLETE, name: "Fernanda Rocha" },
  { email: "patricia@ventu.demo", role: UserRole.ATHLETE, name: "Patricia Ramos" },
];

const ATHLETE_PROFILES = [
  {
    email: "atleta@ventu.demo",
    city: "Florianopolis",
    state: "SC",
    cpf: "12345678901",
    sportLevel: SportLevel.ADVANCED,
    sportGoal: "Maratona com progressao segura de volume",
    thresholdPace: "4:45/km",
    nextCompetitionDate: new Date("2026-11-15T05:30:00.000Z"),
  },
  {
    email: "lucas@ventu.demo",
    city: "Curitiba",
    state: "PR",
    cpf: "32165498700",
    sportLevel: SportLevel.INTERMEDIATE,
    sportGoal: "Melhorar 10K mantendo rotina de forca",
  },
  {
    email: "ana@ventu.demo",
    city: "Porto Alegre",
    state: "RS",
    cpf: "98765432100",
    sportLevel: SportLevel.INTERMEDIATE,
    sportGoal: "Condicionamento e consistencia semanal",
  },
  { email: "thiago@ventu.demo", city: "Joinville", state: "SC", cpf: "45512233001" },
  { email: "paula@ventu.demo", city: "Balneario Camboriu", state: "SC", cpf: "45512233002" },
  { email: "bruno@ventu.demo", city: "Curitiba", state: "PR", cpf: "45512233003" },
  { email: "juliana@ventu.demo", city: "Londrina", state: "PR", cpf: "45512233004" },
  { email: "renato@ventu.demo", city: "Blumenau", state: "SC", cpf: "45512233005" },
  { email: "camila@ventu.demo", city: "Porto Alegre", state: "RS", cpf: "45512233006" },
  { email: "danilo@ventu.demo", city: "Caxias do Sul", state: "RS", cpf: "45512233007" },
  { email: "fernanda@ventu.demo", city: "Florianopolis", state: "SC", cpf: "45512233008" },
  { email: "patricia@ventu.demo", city: "Curitiba", state: "PR", cpf: "45512233009" },
];

const EXERCISE_LIBRARY = [
  {
    name: "Rodagem leve",
    modality: "Corrida",
    stimulus_type: "Base aerobica",
    intensity_label: "Leve",
    duration_minutes: 45,
    instructions: "Ritmo confortavel, respiracao controlada e tecnica solta.",
    contraindications: "Evitar se houver dor aguda ou fadiga elevada.",
    level_recommended: SportLevel.BEGINNER,
  },
  {
    name: "Intervalos progressivos",
    modality: "Corrida",
    stimulus_type: "Ritmo",
    intensity_label: "Moderada/Alta",
    duration_minutes: 50,
    instructions: "Alternar blocos moderados com recuperacao curta.",
    contraindications: "Nao aplicar em retorno de lesao sem revisao tecnica.",
    level_recommended: SportLevel.INTERMEDIATE,
  },
  {
    name: "Longo controlado",
    modality: "Corrida",
    stimulus_type: "Volume",
    intensity_label: "Moderada",
    duration_minutes: 75,
    instructions: "Manter esforco sustentavel, hidratacao e regularidade.",
    contraindications: "Reduzir volume em caso de dor persistente.",
    level_recommended: SportLevel.INTERMEDIATE,
  },
  {
    name: "Agachamento",
    modality: "Forca",
    stimulus_type: "Membros inferiores",
    intensity_label: "Forca",
    series: 3,
    repetitions: "8-10",
    load_description: "Carga moderada com tecnica estavel.",
    instructions: "Controlar descida, joelhos alinhados e tronco firme.",
    contraindications: "Ajustar amplitude em desconforto no joelho ou quadril.",
    level_recommended: SportLevel.BEGINNER,
  },
  {
    name: "Core e prancha",
    modality: "Forca",
    stimulus_type: "Estabilidade",
    intensity_label: "Controle",
    series: 3,
    repetitions: "30-45 segundos",
    instructions: "Manter alinhamento sem prender a respiracao.",
    contraindications: "Interromper se houver dor lombar.",
    level_recommended: SportLevel.BEGINNER,
  },
  {
    name: "Mobilidade regenerativa",
    modality: "Recuperacao",
    stimulus_type: "Mobilidade",
    intensity_label: "Leve",
    duration_minutes: 20,
    instructions: "Sequencia leve para quadril, tornozelo, posterior e coluna toracica.",
    contraindications: "Nao forcar amplitude com dor.",
    level_recommended: SportLevel.BEGINNER,
  },
];

async function upsertOrganization() {
  return prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {
      name: "Ventu Suli Running Team",
      plan: OrgPlan.PRO,
      settings: {
        allowAthleteSelfSignup: true,
        requireAthleteApproval: false,
        branding: {
          primaryColor: "#F5A623",
          supportEmail: "suporte@ventusuli.app",
          slogan: "Performance com gestao inteligente",
        },
      },
    },
    create: {
      name: "Ventu Suli Running Team",
      slug: ORG_SLUG,
      plan: OrgPlan.PRO,
      settings: {
        allowAthleteSelfSignup: true,
        requireAthleteApproval: false,
        branding: {
          primaryColor: "#F5A623",
          supportEmail: "suporte@ventusuli.app",
          slogan: "Performance com gestao inteligente",
        },
      },
    },
  });
}

async function upsertPlatformSuperAdmin() {
  const organization = await prisma.organization.upsert({
    where: { slug: PLATFORM_ORG_SLUG },
    update: {
      name: "Ventu Suli Platform",
      plan: OrgPlan.ENTERPRISE,
    },
    create: {
      name: "Ventu Suli Platform",
      slug: PLATFORM_ORG_SLUG,
      plan: OrgPlan.ENTERPRISE,
      settings: {
        internal: true,
      },
    },
    select: { id: true, slug: true },
  });

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      organization_id: organization.id,
      role: UserRole.SUPER_ADMIN,
      name: "Ventu Suli Super Admin",
      password_hash: passwordHash,
      account_status: "ACTIVE",
      email_verified: true,
    },
    create: {
      organization_id: organization.id,
      email: SUPER_ADMIN_EMAIL,
      password_hash: passwordHash,
      role: UserRole.SUPER_ADMIN,
      name: "Ventu Suli Super Admin",
      account_status: "ACTIVE",
      email_verified: true,
    },
  });

  return organization;
}

async function upsertOrganizationInvite(organizationId) {
  const existing = await prisma.organizationInvite.findUnique({
    where: { token: DEMO_INVITE_TOKEN },
    select: { id: true },
  });

  if (existing) {
    await prisma.organizationInvite.update({
      where: { id: existing.id },
      data: {
        organization_id: organizationId,
        active: true,
        expires_at: null,
        max_uses: null,
      },
    });
    return;
  }

  await prisma.organizationInvite.create({
    data: {
      organization_id: organizationId,
      token: DEMO_INVITE_TOKEN,
      active: true,
      expires_at: null,
      max_uses: null,
    },
  });
}

async function upsertUsers(organizationId) {
  const defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const athletePasswordHash = await bcrypt.hash(ATHLETE_DEMO_PASSWORD, 12);
  const usersByEmail = {};

  for (const profile of USERS) {
    const password_hash =
      profile.email === "atleta@ventu.demo" ? athletePasswordHash : defaultPasswordHash;

    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        organization_id: organizationId,
        role: profile.role,
        name: profile.name,
        password_hash,
        account_status: "ACTIVE",
        email_verified: true,
      },
      create: {
        organization_id: organizationId,
        email: profile.email,
        password_hash,
        role: profile.role,
        name: profile.name,
        account_status: "ACTIVE",
        email_verified: true,
      },
    });
    usersByEmail[profile.email] = user;
  }

  return usersByEmail;
}

async function upsertAthleteProfile(organizationId, athlete, profile) {
  await prisma.athleteProfile.upsert({
    where: { user_id: athlete.id },
    update: {
      organization_id: organizationId,
      cpf: profile.cpf,
      city: profile.city,
      state: profile.state,
      phone: "48999990000",
      primary_modality: profile.primaryModality ?? "Corrida",
      sport_level: profile.sportLevel ?? SportLevel.INTERMEDIATE,
      sport_goal: profile.sportGoal ?? "Condicionamento e evolucao gradual",
      injury_history: profile.injuryHistory ?? null,
      weekly_availability: profile.weeklyAvailability ?? {
        monday: true,
        tuesday: false,
        wednesday: true,
        thursday: false,
        friday: true,
        saturday: true,
        sunday: false,
      },
      available_equipment: profile.availableEquipment ?? ["peso corporal", "halteres", "elastico"],
      resting_heart_rate: profile.restingHeartRate ?? 58,
      threshold_pace: profile.thresholdPace ?? null,
      max_load_notes: profile.maxLoadNotes ?? null,
      next_competition_date: profile.nextCompetitionDate ?? null,
      medical_restrictions: profile.medicalRestrictions ?? null,
      coach_notes: profile.coachNotes ?? "Monitorar resposta de carga antes de progredir.",
    },
    create: {
      user_id: athlete.id,
      organization_id: organizationId,
      cpf: profile.cpf,
      city: profile.city,
      state: profile.state,
      phone: "48999990000",
      primary_modality: profile.primaryModality ?? "Corrida",
      sport_level: profile.sportLevel ?? SportLevel.INTERMEDIATE,
      sport_goal: profile.sportGoal ?? "Condicionamento e evolucao gradual",
      injury_history: profile.injuryHistory ?? null,
      weekly_availability: profile.weeklyAvailability ?? {
        monday: true,
        tuesday: false,
        wednesday: true,
        thursday: false,
        friday: true,
        saturday: true,
        sunday: false,
      },
      available_equipment: profile.availableEquipment ?? ["peso corporal", "halteres", "elastico"],
      resting_heart_rate: profile.restingHeartRate ?? 58,
      threshold_pace: profile.thresholdPace ?? null,
      max_load_notes: profile.maxLoadNotes ?? null,
      next_competition_date: profile.nextCompetitionDate ?? null,
      medical_restrictions: profile.medicalRestrictions ?? null,
      coach_notes: profile.coachNotes ?? "Monitorar resposta de carga antes de progredir.",
    },
  });
}

async function seedExerciseLibrary({ organizationId, createdBy }) {
  for (const exercise of EXERCISE_LIBRARY) {
    const existing = await prisma.exercise.findFirst({
      where: {
        organization_id: organizationId,
        name: exercise.name,
        modality: exercise.modality,
      },
      select: { id: true },
    });

    const data = {
      organization_id: organizationId,
      created_by: createdBy,
      active: true,
      ...exercise,
    };

    if (existing) {
      await prisma.exercise.update({
        where: { id: existing.id },
        data,
      });
      continue;
    }

    await prisma.exercise.create({ data });
  }
}

async function upsertEventWithDistances({ organizationId, creatorId, event, distances }) {
  const existing = await prisma.event.findFirst({
    where: {
      organization_id: organizationId,
      name: event.name,
    },
  });

  const savedEvent = existing
    ? await prisma.event.update({
        where: { id: existing.id },
        data: {
          ...event,
          organization_id: organizationId,
          created_by: creatorId,
        },
      })
    : await prisma.event.create({
        data: {
          ...event,
          organization_id: organizationId,
          created_by: creatorId,
        },
      });

  for (const distance of distances) {
    const existingDistance = await prisma.eventDistance.findFirst({
      where: {
        event_id: savedEvent.id,
        label: distance.label,
      },
      select: { id: true },
    });

    if (existingDistance) {
      await prisma.eventDistance.update({
        where: { id: existingDistance.id },
        data: {
          distance_km: distance.distance_km,
          price_cents: distance.price_cents,
          max_slots: distance.max_slots,
          registered_count: distance.registered_count ?? 0,
        },
      });
      continue;
    }

    await prisma.eventDistance.create({
      data: {
        event_id: savedEvent.id,
        label: distance.label,
        distance_km: distance.distance_km,
        price_cents: distance.price_cents,
        max_slots: distance.max_slots,
        registered_count: distance.registered_count ?? 0,
      },
    });
  }

  return prisma.event.findUnique({
    where: { id: savedEvent.id },
    include: { distances: { orderBy: { distance_km: "asc" } } },
  });
}

function buildEfiTxId(registrationId) {
  return `VS-${registrationId.replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}

function buildPixCode(registrationId, amountCents) {
  return `00020126580014BR.GOV.BCB.PIX0136${EFI_PIX_KEY}520400005303986540${(
    amountCents / 100
  ).toFixed(2)}5802BR5909VENTUSULI6009SAOPAULO62070503***6304${registrationId
    .replace(/-/g, "")
    .slice(0, 4)
    .toUpperCase()}`;
}

async function upsertRegistrationAndPayment({
  organizationId,
  athleteId,
  event,
  distanceLabel,
  registrationStatus,
  paymentStatus,
  paidAt,
  expiresAt,
}) {
  const distance = event.distances.find((item) => item.label === distanceLabel);
  if (!distance) return;

  const registration = await prisma.registration.upsert({
    where: {
      user_id_event_id_distance_id: {
        user_id: athleteId,
        event_id: event.id,
        distance_id: distance.id,
      },
    },
    update: {
      status: registrationStatus,
      organization_id: organizationId,
    },
    create: {
      user_id: athleteId,
      event_id: event.id,
      distance_id: distance.id,
      organization_id: organizationId,
      status: registrationStatus,
    },
  });

  await prisma.payment.upsert({
    where: { registration_id: registration.id },
    update: {
      user_id: athleteId,
      organization_id: organizationId,
      amount_cents: distance.price_cents,
      fee_cents: Math.round(distance.price_cents * 0.05),
      net_cents: Math.round(distance.price_cents * 0.95),
      status: paymentStatus,
      paid_at: paidAt ?? null,
      expires_at: expiresAt ?? null,
      efi_tx_id: buildEfiTxId(registration.id),
      pix_key: EFI_PIX_KEY,
      qr_code_url: buildPixCode(registration.id, distance.price_cents),
    },
    create: {
      registration_id: registration.id,
      user_id: athleteId,
      organization_id: organizationId,
      amount_cents: distance.price_cents,
      fee_cents: Math.round(distance.price_cents * 0.05),
      net_cents: Math.round(distance.price_cents * 0.95),
      status: paymentStatus,
      paid_at: paidAt ?? null,
      expires_at: expiresAt ?? null,
      efi_tx_id: buildEfiTxId(registration.id),
      pix_key: EFI_PIX_KEY,
      qr_code_url: buildPixCode(registration.id, distance.price_cents),
    },
  });
}

async function seedCommunity({ organizationId, users }) {
  const postsSeed = [
    {
      authorEmail: "admin@ventu.demo",
      tab: "Feed",
      content: "Bem-vindos à comunidade Ventu Suli! Usem este espaço para compartilhar treinos, resultados e dúvidas.",
      comments: [
        { authorEmail: "atleta@ventu.demo", text: "Top! Vou postar os treinos da semana por aqui." },
        { authorEmail: "coach@ventu.demo", text: "Perfeito. Vou usar esse canal para avisos técnicos." },
      ],
    },
    {
      authorEmail: "atleta@ventu.demo",
      tab: "Treinos",
      content: "Treino de limiar fechado hoje: 3x10min forte. Alguém vai no longão de domingo?",
      comments: [
        { authorEmail: "admin@ventu.demo", text: "Excelente sessão. Domingo teremos equipe às 6h no parque." },
        { authorEmail: "ana@ventu.demo", text: "Eu vou! Quero fechar 16km progressivo." },
      ],
    },
    {
      authorEmail: "coach@ventu.demo",
      tab: "Resultados",
      content: "Parabéns ao grupo: 11 novos PRs nas últimas 4 semanas. Consistência está fazendo diferença.",
      comments: [
        { authorEmail: "paula@ventu.demo", text: "Muito bom! Vamos manter o bloco para a meia." },
      ],
    },
  ];

  for (const item of postsSeed) {
    const author = users[item.authorEmail];
    if (!author) continue;

    const postRows = await prisma.$queryRaw`
      SELECT id
      FROM public.community_posts
      WHERE organization_id = ${organizationId}
        AND user_id = ${author.id}
        AND content = ${item.content}
      LIMIT 1
    `;

    let postId = postRows[0]?.id;

    if (!postId) {
      postId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO public.community_posts (id, organization_id, user_id, tab, content, created_at)
        VALUES (${postId}, ${organizationId}, ${author.id}, ${item.tab}, ${item.content}, now())
      `;
    }

    for (const commentSeed of item.comments) {
      const commentAuthor = users[commentSeed.authorEmail];
      if (!commentAuthor) continue;

      const existingComment = await prisma.$queryRaw`
        SELECT id
        FROM public.community_comments
        WHERE post_id = ${postId}
          AND user_id = ${commentAuthor.id}
          AND text = ${commentSeed.text}
        LIMIT 1
      `;

      if (existingComment.length) continue;

      await prisma.$executeRaw`
        INSERT INTO public.community_comments (id, post_id, organization_id, user_id, text, created_at)
        VALUES (${randomUUID()}, ${postId}, ${organizationId}, ${commentAuthor.id}, ${commentSeed.text}, now())
      `;
    }
  }
}

async function main() {
  if (IS_PRODUCTION && !DEMO_SEED_ENABLED) {
    throw new Error(
      "Seed demo bloqueado em production. Defina DEMO_SEED_ENABLED=true apenas em ambiente de demo/staging.",
    );
  }

  const organization = await upsertOrganization();
  await upsertPlatformSuperAdmin();
  await upsertOrganizationInvite(organization.id);
  const users = await upsertUsers(organization.id);

  for (const profile of ATHLETE_PROFILES) {
    const athlete = users[profile.email];
    if (!athlete) continue;
    await upsertAthleteProfile(organization.id, athlete, profile);
  }

  await seedExerciseLibrary({
    organizationId: organization.id,
    createdBy: users["coach@ventu.demo"].id,
  });

  const eventSeeds = [
    {
      event: {
        name: "Corrida da Ponte 2026",
        city: "Florianopolis",
        state: "SC",
        address: "Avenida Beira-Mar Norte, 3000",
        event_date: new Date("2026-08-23T06:30:00.000Z"),
        registration_deadline: new Date("2026-08-10T23:59:59.000Z"),
        description: "Prova urbana com percurso rapido e clima de festival esportivo.",
        external_url: "https://example.com/corrida-da-ponte",
        status: EventStatus.PUBLISHED,
      },
      distances: [
        { label: "5K", distance_km: "5.000", price_cents: 9900, max_slots: 400, registered_count: 264 },
        { label: "10K", distance_km: "10.000", price_cents: 12900, max_slots: 300, registered_count: 219 },
      ],
    },
    {
      event: {
        name: "Meia Maratona Serra Azul",
        city: "Blumenau",
        state: "SC",
        address: "Parque Ramiro Rudiger",
        event_date: new Date("2026-09-20T05:45:00.000Z"),
        registration_deadline: new Date("2026-09-05T23:59:59.000Z"),
        description: "Altimetria desafiadora para atletas que buscam performance.",
        external_url: "https://example.com/meia-serra-azul",
        status: EventStatus.PUBLISHED,
      },
      distances: [
        { label: "10K", distance_km: "10.000", price_cents: 13900, max_slots: 250, registered_count: 186 },
        { label: "21K", distance_km: "21.097", price_cents: 18900, max_slots: 200, registered_count: 171 },
      ],
    },
    {
      event: {
        name: "Maratona Ventu Suli",
        city: "Curitiba",
        state: "PR",
        address: "Parque Barigui",
        event_date: new Date("2026-11-15T05:30:00.000Z"),
        registration_deadline: new Date("2026-10-30T23:59:59.000Z"),
        description: "Festival com distancias para todos os niveis e area premium para assessorias.",
        external_url: "https://example.com/maratona-ventu-suli",
        status: EventStatus.PUBLISHED,
      },
      distances: [
        { label: "5K", distance_km: "5.000", price_cents: 10900, max_slots: 500, registered_count: 293 },
        { label: "10K", distance_km: "10.000", price_cents: 14900, max_slots: 400, registered_count: 337 },
        { label: "21K", distance_km: "21.097", price_cents: 19900, max_slots: 300, registered_count: 248 },
        { label: "42K", distance_km: "42.195", price_cents: 25900, max_slots: 150, registered_count: 118 },
      ],
    },
    {
      event: {
        name: "Night Run Centro 2026",
        city: "Florianopolis",
        state: "SC",
        address: "Praca XV de Novembro",
        event_date: new Date("2026-12-05T23:00:00.000Z"),
        registration_deadline: new Date("2026-11-28T23:59:59.000Z"),
        description: "Prova noturna com percursos curtos para alto engajamento da comunidade.",
        external_url: "https://example.com/night-run-centro",
        status: EventStatus.DRAFT,
      },
      distances: [
        { label: "3K", distance_km: "3.000", price_cents: 7900, max_slots: 350, registered_count: 0 },
        { label: "6K", distance_km: "6.000", price_cents: 9900, max_slots: 300, registered_count: 0 },
      ],
    },
    {
      event: {
        name: "Trail Vale Europeu 2026",
        city: "Pomerode",
        state: "SC",
        address: "Parque Municipal de Eventos",
        event_date: new Date("2026-07-12T07:00:00.000Z"),
        registration_deadline: new Date("2026-06-28T23:59:59.000Z"),
        description: "Trail com percursos tecnicos e visual de montanha.",
        external_url: "https://example.com/trail-vale-europeu",
        status: EventStatus.FINISHED,
      },
      distances: [
        { label: "8K", distance_km: "8.000", price_cents: 11900, max_slots: 220, registered_count: 196 },
        { label: "16K", distance_km: "16.000", price_cents: 16900, max_slots: 180, registered_count: 157 },
      ],
    },
    {
      event: {
        name: "Circuito Litoral Sul 2026",
        city: "Imbituba",
        state: "SC",
        address: "Avenida Beira Mar",
        event_date: new Date("2026-10-04T06:15:00.000Z"),
        registration_deadline: new Date("2026-09-24T23:59:59.000Z"),
        description: "Circuito de rua com foco em performance e experiencia de equipe.",
        external_url: "https://example.com/circuito-litoral-sul",
        status: EventStatus.PUBLISHED,
      },
      distances: [
        { label: "5K", distance_km: "5.000", price_cents: 9900, max_slots: 350, registered_count: 241 },
        { label: "10K", distance_km: "10.000", price_cents: 13900, max_slots: 280, registered_count: 204 },
      ],
    },
  ];

  const savedEvents = [];
  for (const item of eventSeeds) {
    const saved = await upsertEventWithDistances({
      organizationId: organization.id,
      creatorId: users["admin@ventu.demo"].id,
      event: item.event,
      distances: item.distances,
    });
    if (saved) savedEvents.push(saved);
  }

  const eventByName = new Map(savedEvents.map((event) => [event.name, event]));
  const scenarios = [
    { athleteEmail: "atleta@ventu.demo", eventName: "Corrida da Ponte 2026", distanceLabel: "10K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-07-28T12:25:00.000Z") },
    { athleteEmail: "lucas@ventu.demo", eventName: "Corrida da Ponte 2026", distanceLabel: "5K", registrationStatus: RegistrationStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.PENDING, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) },
    { athleteEmail: "ana@ventu.demo", eventName: "Corrida da Ponte 2026", distanceLabel: "10K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-07-29T10:20:00.000Z") },
    { athleteEmail: "paula@ventu.demo", eventName: "Corrida da Ponte 2026", distanceLabel: "5K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-07-30T08:35:00.000Z") },
    { athleteEmail: "bruno@ventu.demo", eventName: "Corrida da Ponte 2026", distanceLabel: "10K", registrationStatus: RegistrationStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.PENDING, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) },

    { athleteEmail: "atleta@ventu.demo", eventName: "Meia Maratona Serra Azul", distanceLabel: "21K", registrationStatus: RegistrationStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.PENDING, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    { athleteEmail: "lucas@ventu.demo", eventName: "Meia Maratona Serra Azul", distanceLabel: "10K", registrationStatus: RegistrationStatus.CANCELLED, paymentStatus: PaymentStatus.CANCELLED },
    { athleteEmail: "camila@ventu.demo", eventName: "Meia Maratona Serra Azul", distanceLabel: "21K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-08-18T14:00:00.000Z") },
    { athleteEmail: "danilo@ventu.demo", eventName: "Meia Maratona Serra Azul", distanceLabel: "10K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-08-19T11:40:00.000Z") },
    { athleteEmail: "fernanda@ventu.demo", eventName: "Meia Maratona Serra Azul", distanceLabel: "21K", registrationStatus: RegistrationStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.EXPIRED, expiresAt: new Date("2026-08-26T09:00:00.000Z") },

    { athleteEmail: "ana@ventu.demo", eventName: "Maratona Ventu Suli", distanceLabel: "5K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-08-20T10:10:00.000Z") },
    { athleteEmail: "lucas@ventu.demo", eventName: "Maratona Ventu Suli", distanceLabel: "21K", registrationStatus: RegistrationStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.EXPIRED, expiresAt: new Date("2026-08-26T09:00:00.000Z") },
    { athleteEmail: "atleta@ventu.demo", eventName: "Maratona Ventu Suli", distanceLabel: "42K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-08-22T11:45:00.000Z") },
    { athleteEmail: "thiago@ventu.demo", eventName: "Maratona Ventu Suli", distanceLabel: "10K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-08-23T09:30:00.000Z") },
    { athleteEmail: "paula@ventu.demo", eventName: "Maratona Ventu Suli", distanceLabel: "21K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.REFUNDED, paidAt: new Date("2026-08-23T13:10:00.000Z") },
    { athleteEmail: "bruno@ventu.demo", eventName: "Maratona Ventu Suli", distanceLabel: "5K", registrationStatus: RegistrationStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.PENDING, expiresAt: new Date(Date.now() + 36 * 60 * 60 * 1000) },
    { athleteEmail: "juliana@ventu.demo", eventName: "Maratona Ventu Suli", distanceLabel: "21K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-08-24T10:55:00.000Z") },
    { athleteEmail: "renato@ventu.demo", eventName: "Maratona Ventu Suli", distanceLabel: "10K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-08-24T14:05:00.000Z") },
    { athleteEmail: "camila@ventu.demo", eventName: "Maratona Ventu Suli", distanceLabel: "42K", registrationStatus: RegistrationStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.PENDING, expiresAt: new Date(Date.now() + 96 * 60 * 60 * 1000) },

    { athleteEmail: "danilo@ventu.demo", eventName: "Trail Vale Europeu 2026", distanceLabel: "16K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-06-20T16:40:00.000Z") },
    { athleteEmail: "fernanda@ventu.demo", eventName: "Trail Vale Europeu 2026", distanceLabel: "8K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-06-21T09:45:00.000Z") },
    { athleteEmail: "patricia@ventu.demo", eventName: "Trail Vale Europeu 2026", distanceLabel: "8K", registrationStatus: RegistrationStatus.CANCELLED, paymentStatus: PaymentStatus.CANCELLED },

    { athleteEmail: "ana@ventu.demo", eventName: "Circuito Litoral Sul 2026", distanceLabel: "10K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-09-10T17:30:00.000Z") },
    { athleteEmail: "atleta@ventu.demo", eventName: "Circuito Litoral Sul 2026", distanceLabel: "5K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-09-11T12:15:00.000Z") },
    { athleteEmail: "paula@ventu.demo", eventName: "Circuito Litoral Sul 2026", distanceLabel: "10K", registrationStatus: RegistrationStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.PENDING, expiresAt: new Date(Date.now() + 60 * 60 * 1000 * 60) },
    { athleteEmail: "renato@ventu.demo", eventName: "Circuito Litoral Sul 2026", distanceLabel: "5K", registrationStatus: RegistrationStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, paidAt: new Date("2026-09-12T09:55:00.000Z") },
    { athleteEmail: "camila@ventu.demo", eventName: "Circuito Litoral Sul 2026", distanceLabel: "10K", registrationStatus: RegistrationStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.EXPIRED, expiresAt: new Date("2026-09-20T09:00:00.000Z") },
  ];

  for (const scenario of scenarios) {
    const event = eventByName.get(scenario.eventName);
    const athlete = users[scenario.athleteEmail];
    if (!event || !athlete) continue;

    await upsertRegistrationAndPayment({
      organizationId: organization.id,
      athleteId: athlete.id,
      event,
      distanceLabel: scenario.distanceLabel,
      registrationStatus: scenario.registrationStatus,
      paymentStatus: scenario.paymentStatus,
      paidAt: scenario.paidAt,
      expiresAt: scenario.expiresAt,
    });
  }

  await seedCommunity({ organizationId: organization.id, users });

  console.log("Seed comercial concluido.");
  console.log(`Admin: admin@ventu.demo / ${DEFAULT_PASSWORD}`);
  console.log(`Coach: coach@ventu.demo / ${DEFAULT_PASSWORD}`);
  console.log(`Atleta: atleta@ventu.demo / ${ATHLETE_DEMO_PASSWORD}`);
  console.log(`Invite token atleta: ${DEMO_INVITE_TOKEN}`);
  console.log(`SUPER_ADMIN: ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
