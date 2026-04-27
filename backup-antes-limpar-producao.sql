--
-- PostgreSQL database dump
--

\restrict Laf3c4pKCTuiQW8NaRKjxtB9gvlP1JagRVBLrdhPGpvx3xHRngBEq3C0B7AlgB2

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AccountStatus; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."AccountStatus" AS ENUM (
    'ACTIVE',
    'PENDING_INVITE',
    'PENDING_APPROVAL',
    'SUSPENDED'
);


ALTER TYPE public."AccountStatus" OWNER TO ventusuli;

--
-- Name: AthleteSignupSource; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."AthleteSignupSource" AS ENUM (
    'SLUG',
    'INVITE',
    'ADMIN'
);


ALTER TYPE public."AthleteSignupSource" OWNER TO ventusuli;

--
-- Name: AthleteStatus; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."AthleteStatus" AS ENUM (
    'PENDING_APPROVAL',
    'ACTIVE',
    'REJECTED',
    'BLOCKED'
);


ALTER TYPE public."AthleteStatus" OWNER TO ventusuli;

--
-- Name: CollectiveStatus; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."CollectiveStatus" AS ENUM (
    'OPEN',
    'CLOSED',
    'CANCELLED'
);


ALTER TYPE public."CollectiveStatus" OWNER TO ventusuli;

--
-- Name: CommunityReactionType; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."CommunityReactionType" AS ENUM (
    'LIKE',
    'FIRE',
    'APPLAUSE'
);


ALTER TYPE public."CommunityReactionType" OWNER TO ventusuli;

--
-- Name: EventStatus; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."EventStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'CANCELLED',
    'FINISHED'
);


ALTER TYPE public."EventStatus" OWNER TO ventusuli;

--
-- Name: NoticeAudience; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."NoticeAudience" AS ENUM (
    'ALL',
    'ATHLETES',
    'COACHES',
    'ADMINS'
);


ALTER TYPE public."NoticeAudience" OWNER TO ventusuli;

--
-- Name: NoticeChannel; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."NoticeChannel" AS ENUM (
    'IN_APP',
    'TELEGRAM'
);


ALTER TYPE public."NoticeChannel" OWNER TO ventusuli;

--
-- Name: NoticeDeliveryStatus; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."NoticeDeliveryStatus" AS ENUM (
    'PENDING',
    'SENT',
    'FAILED'
);


ALTER TYPE public."NoticeDeliveryStatus" OWNER TO ventusuli;

--
-- Name: NoticeStatus; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."NoticeStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
);


ALTER TYPE public."NoticeStatus" OWNER TO ventusuli;

--
-- Name: OrgPlan; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."OrgPlan" AS ENUM (
    'FREE',
    'STARTER',
    'PRO',
    'ENTERPRISE'
);


ALTER TYPE public."OrgPlan" OWNER TO ventusuli;

--
-- Name: OrgStatus; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."OrgStatus" AS ENUM (
    'PENDING_SETUP',
    'ACTIVE',
    'SUSPENDED',
    'TRIAL',
    'CANCELLED'
);


ALTER TYPE public."OrgStatus" OWNER TO ventusuli;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'EXPIRED',
    'REFUNDED',
    'CANCELLED'
);


ALTER TYPE public."PaymentStatus" OWNER TO ventusuli;

--
-- Name: RegistrationStatus; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."RegistrationStatus" AS ENUM (
    'INTERESTED',
    'PENDING_PAYMENT',
    'CONFIRMED',
    'CANCELLED'
);


ALTER TYPE public."RegistrationStatus" OWNER TO ventusuli;

--
-- Name: StravaSyncStatus; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."StravaSyncStatus" AS ENUM (
    'RECEIVED',
    'PROCESSING',
    'SYNCED',
    'SKIPPED',
    'IGNORED',
    'FAILED'
);


ALTER TYPE public."StravaSyncStatus" OWNER TO ventusuli;

--
-- Name: StravaSyncTrigger; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."StravaSyncTrigger" AS ENUM (
    'WEBHOOK',
    'MANUAL',
    'OAUTH_CALLBACK',
    'SCHEDULED'
);


ALTER TYPE public."StravaSyncTrigger" OWNER TO ventusuli;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: ventusuli
--

CREATE TYPE public."UserRole" AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'COACH',
    'ATHLETE'
);


ALTER TYPE public."UserRole" OWNER TO ventusuli;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO ventusuli;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.activities (
    id text NOT NULL,
    external_source text NOT NULL,
    external_id text NOT NULL,
    user_id text NOT NULL,
    organization_id text NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    distance_m integer,
    moving_time_s integer,
    elapsed_time_s integer,
    average_pace_sec_km numeric(8,2),
    average_hr integer,
    max_hr integer,
    elevation_gain_m integer,
    activity_date timestamp(3) without time zone NOT NULL,
    raw_payload jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.activities OWNER TO ventusuli;

--
-- Name: admin_activation_invites; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.admin_activation_invites (
    id text NOT NULL,
    organization_id text NOT NULL,
    email text NOT NULL,
    token text NOT NULL,
    role public."UserRole" DEFAULT 'ADMIN'::public."UserRole" NOT NULL,
    active boolean DEFAULT true NOT NULL,
    expires_at timestamp(3) without time zone,
    accepted_at timestamp(3) without time zone,
    invited_by text,
    invitee_name text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.admin_activation_invites OWNER TO ventusuli;

--
-- Name: athlete_profiles; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.athlete_profiles (
    id text NOT NULL,
    user_id text NOT NULL,
    organization_id text NOT NULL,
    cpf text,
    birth_date timestamp(3) without time zone,
    gender text,
    phone text,
    city text,
    state text,
    weight_kg numeric(5,2),
    height_cm integer,
    shirt_size text,
    emergency_contact jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    athlete_status public."AthleteStatus" DEFAULT 'ACTIVE'::public."AthleteStatus" NOT NULL,
    signup_source public."AthleteSignupSource" DEFAULT 'SLUG'::public."AthleteSignupSource" NOT NULL,
    onboarding_completed_at timestamp(3) without time zone
);


ALTER TABLE public.athlete_profiles OWNER TO ventusuli;

--
-- Name: collective_members; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.collective_members (
    id text NOT NULL,
    collective_signup_id text NOT NULL,
    user_id text NOT NULL,
    distance_id text NOT NULL,
    payment_id text,
    joined_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.collective_members OWNER TO ventusuli;

--
-- Name: collective_signups; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.collective_signups (
    id text NOT NULL,
    event_id text NOT NULL,
    organization_id text NOT NULL,
    created_by text NOT NULL,
    name text NOT NULL,
    status public."CollectiveStatus" DEFAULT 'OPEN'::public."CollectiveStatus" NOT NULL,
    deadline timestamp(3) without time zone,
    max_members integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.collective_signups OWNER TO ventusuli;

--
-- Name: community_comments; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.community_comments (
    id text NOT NULL,
    post_id text NOT NULL,
    organization_id text NOT NULL,
    user_id text NOT NULL,
    text text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.community_comments OWNER TO ventusuli;

--
-- Name: community_posts; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.community_posts (
    id text NOT NULL,
    organization_id text NOT NULL,
    user_id text NOT NULL,
    tab text DEFAULT 'Feed'::text NOT NULL,
    content text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.community_posts OWNER TO ventusuli;

--
-- Name: community_reactions; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.community_reactions (
    id text NOT NULL,
    post_id text NOT NULL,
    organization_id text NOT NULL,
    user_id text NOT NULL,
    type public."CommunityReactionType" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.community_reactions OWNER TO ventusuli;

--
-- Name: event_distances; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.event_distances (
    id text NOT NULL,
    event_id text NOT NULL,
    label text NOT NULL,
    distance_km numeric(6,3) NOT NULL,
    price_cents integer NOT NULL,
    max_slots integer,
    registered_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.event_distances OWNER TO ventusuli;

--
-- Name: events; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.events (
    id text NOT NULL,
    organization_id text NOT NULL,
    created_by text NOT NULL,
    name text NOT NULL,
    city text,
    state character(2),
    address text,
    event_date timestamp(3) without time zone NOT NULL,
    registration_deadline timestamp(3) without time zone,
    description text,
    image_url text,
    external_url text,
    status public."EventStatus" DEFAULT 'DRAFT'::public."EventStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.events OWNER TO ventusuli;

--
-- Name: notice_deliveries; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.notice_deliveries (
    id text NOT NULL,
    notice_id text NOT NULL,
    organization_id text,
    channel public."NoticeChannel" NOT NULL,
    status public."NoticeDeliveryStatus" DEFAULT 'PENDING'::public."NoticeDeliveryStatus" NOT NULL,
    external_id text,
    error_message text,
    sent_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_attempt_at timestamp(3) without time zone
);


ALTER TABLE public.notice_deliveries OWNER TO ventusuli;

--
-- Name: notices; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.notices (
    id text NOT NULL,
    organization_id text,
    created_by text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    audience public."NoticeAudience" DEFAULT 'ALL'::public."NoticeAudience" NOT NULL,
    status public."NoticeStatus" DEFAULT 'DRAFT'::public."NoticeStatus" NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    publish_at timestamp(3) without time zone,
    telegram_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.notices OWNER TO ventusuli;

--
-- Name: organization_invites; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.organization_invites (
    id text NOT NULL,
    organization_id text NOT NULL,
    token text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    expires_at timestamp(3) without time zone,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    label text
);


ALTER TABLE public.organization_invites OWNER TO ventusuli;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.organizations (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    plan public."OrgPlan" DEFAULT 'FREE'::public."OrgPlan" NOT NULL,
    plan_expires_at timestamp(3) without time zone,
    settings jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."OrgStatus" DEFAULT 'PENDING_SETUP'::public."OrgStatus" NOT NULL,
    setup_completed_at timestamp(3) without time zone
);


ALTER TABLE public.organizations OWNER TO ventusuli;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.password_reset_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    used_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO ventusuli;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.payments (
    id text NOT NULL,
    registration_id text NOT NULL,
    organization_id text NOT NULL,
    amount_cents integer NOT NULL,
    paid_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    efi_charge_id text,
    efi_tx_id text,
    expires_at timestamp(3) without time zone,
    fee_cents integer DEFAULT 0 NOT NULL,
    net_cents integer NOT NULL,
    pix_key text,
    qr_code_url text,
    user_id text NOT NULL,
    webhook_payload jsonb,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL
);


ALTER TABLE public.payments OWNER TO ventusuli;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.refresh_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    organization_id text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.refresh_tokens OWNER TO ventusuli;

--
-- Name: registrations; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.registrations (
    id text NOT NULL,
    user_id text NOT NULL,
    event_id text NOT NULL,
    distance_id text NOT NULL,
    organization_id text NOT NULL,
    status public."RegistrationStatus" DEFAULT 'INTERESTED'::public."RegistrationStatus" NOT NULL,
    notes text,
    registered_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.registrations OWNER TO ventusuli;

--
-- Name: strava_connections; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.strava_connections (
    id text NOT NULL,
    user_id text NOT NULL,
    organization_id text NOT NULL,
    strava_athlete_id text NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    scopes text[] DEFAULT ARRAY[]::text[],
    last_sync_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.strava_connections OWNER TO ventusuli;

--
-- Name: strava_sync_logs; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.strava_sync_logs (
    id text NOT NULL,
    organization_id text,
    user_id text,
    strava_athlete_id text NOT NULL,
    trigger public."StravaSyncTrigger" DEFAULT 'WEBHOOK'::public."StravaSyncTrigger" NOT NULL,
    status public."StravaSyncStatus" DEFAULT 'RECEIVED'::public."StravaSyncStatus" NOT NULL,
    idempotency_key text NOT NULL,
    object_type text NOT NULL,
    aspect_type text NOT NULL,
    object_id text NOT NULL,
    subscription_id text,
    event_time timestamp(3) without time zone,
    payload jsonb,
    sync_result jsonb,
    error_message text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    processed_at timestamp(3) without time zone,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.strava_sync_logs OWNER TO ventusuli;

--
-- Name: users; Type: TABLE; Schema: public; Owner: ventusuli
--

CREATE TABLE public.users (
    id text NOT NULL,
    organization_id text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role public."UserRole" DEFAULT 'ATHLETE'::public."UserRole" NOT NULL,
    name text NOT NULL,
    avatar_url text,
    email_verified boolean DEFAULT false NOT NULL,
    last_login_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    account_status public."AccountStatus" DEFAULT 'ACTIVE'::public."AccountStatus" NOT NULL
);


ALTER TABLE public.users OWNER TO ventusuli;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
1b411a9a-6f5e-400c-9d2b-fb8b554f7709	8b0faca96c080b619c5f732e11274d83a2e15a882b72f3e71fc1aafba1bd989e	2026-04-25 16:26:11.335513+00	20260411000000_init_auth	\N	\N	2026-04-25 16:26:11.231476+00	1
a962624a-3d4c-4ba9-999e-d90fe5b44d5e	7095d936c034716d5da2adf664f745a450d910404d8757339a4800e9edb25e8f	2026-04-25 16:26:11.88514+00	20260419193000_add_organization_status	\N	\N	2026-04-25 16:26:11.873559+00	1
47ce0b57-b7fc-4c11-8b2c-2e948747f789	3e64cffd1eede56a95dd23725392f5d2d20b7f7e72c91f46fc4038d7ae298f02	2026-04-25 16:26:11.426316+00	20260411100000_add_events	\N	\N	2026-04-25 16:26:11.337472+00	1
7559e565-1da8-4892-b913-59f593c0aac0	8601276ba45471902e56832ba76b0668d9737d818bc980390f511793314c0c8b	2026-04-25 16:26:11.511677+00	20260411113000_add_payments	\N	\N	2026-04-25 16:26:11.428194+00	1
d2a5a06a-2a70-44cb-a2eb-a62b2c25bb5f	128b41759ee5cb74548fc01591d138ba2669d25e246832ad5223529b8bff83e6	2026-04-25 16:26:11.534509+00	20260415123000_add_operational_indexes	\N	\N	2026-04-25 16:26:11.513442+00	1
0a17ae0d-0533-4073-80fe-cae9293e568d	48ab0fc0826ceb341dc561ef1647ca6b78f64fef124f1aa91324bd8263d48e9f	2026-04-25 16:26:11.892521+00	20260419224000_add_organization_setup_completed_at	\N	\N	2026-04-25 16:26:11.886854+00	1
fa906815-311e-46ed-8c08-f0a38db4be69	a6c08c150a3360230dde909aab9b6b805cf97bcd45b6525e833ff1810d06dd0d	2026-04-25 16:26:11.584264+00	20260415170000_add_community_social	\N	\N	2026-04-25 16:26:11.536306+00	1
bdc1c941-5286-46ec-9748-6bac12417369	268fe9762aaddafd11501d228096053bb720d090c66b3c74b0ed2129ebf36faa	2026-04-25 16:26:11.622066+00	20260415193000_add_community_reactions	\N	\N	2026-04-25 16:26:11.585965+00	1
24e43b62-1fb8-4226-867a-7f92d8a1769c	84261995b3bac86ca2dafbd1cf50b36435987bae9ed11794dc7d58e4fa1dd1d6	2026-04-25 16:26:11.649998+00	20260415213000_add_organization_invites	\N	\N	2026-04-25 16:26:11.623783+00	1
e4acbb64-7b7d-4f69-9d68-9cec977cfbff	b6d7a7270861323fcd22b5dd000dbad9f237303fa7531d1957cb366c407f9178	2026-04-25 16:26:11.905419+00	20260419235500_add_athlete_status	\N	\N	2026-04-25 16:26:11.8943+00	1
6c00053b-e5d1-4900-bf62-e6604c276ab9	ace2fd1f02b6153037971adc01655187dfe82d141bb7d86bf1789da82504dbde	2026-04-25 16:26:11.705192+00	20260418133000_add_notices_module	\N	\N	2026-04-25 16:26:11.651864+00	1
87a9167b-99f1-45c8-b5d0-7e492a93aac2	62e5ecb6cb8ce1740724d3708cf4e721e28f9f4d19721be5449e68c9d38735c2	2026-04-25 16:26:11.717144+00	20260418152000_notices_saas_upgrade	\N	\N	2026-04-25 16:26:11.706955+00	1
88df542e-1d39-407b-b9b4-f7b5576d3337	465e1ff4803d2e2f9bce3889804e8c1dc8ba58b52d57602c9f05a22086ead86d	2026-04-25 16:26:11.774789+00	20260418183000_add_strava_integration	\N	\N	2026-04-25 16:26:11.718915+00	1
00a5eec4-4640-423c-975e-243c895ef27b	52444e1f79ce89091b905c53759dc7f4f7dbf43fd31974745da401fcbb1d58f3	2026-04-25 16:26:11.918622+00	20260420000500_add_athlete_onboarding_fields	\N	\N	2026-04-25 16:26:11.907128+00	1
6e4ec1bd-eb69-4c79-9269-d00ec68a2631	4471dc0bc77a9b69af7bee1b8a352311bebc6050975df14ad2789774078da682	2026-04-25 16:26:11.810928+00	20260418195000_add_strava_webhook_sync_logs	\N	\N	2026-04-25 16:26:11.776524+00	1
7e368405-e547-40d8-9495-e660d7bc1881	e0db842ea64272a7c205d599766a8bbef0967d24ef57a34d00d3081ec8c610fa	2026-04-25 16:26:11.84413+00	20260419120000_super_admin_commercial_flow	\N	\N	2026-04-25 16:26:11.812799+00	1
8f309033-570c-440d-bd02-46efe2c54cf2	e71396ec8ecfd3f8bf6c7ec64220bf43547d9ba3595ae5800c06336885276646	2026-04-25 16:26:11.871676+00	20260419173000_add_password_reset_tokens	\N	\N	2026-04-25 16:26:11.845922+00	1
080647aa-848f-4ae4-855e-585e36713bfe	35b1c7e573909a376096d59f02ee83ccb4ffd62823e8ed532523871250391354	2026-04-25 16:26:11.935363+00	20260420093000_notice_global_scope	\N	\N	2026-04-25 16:26:11.920352+00	1
\.


--
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.activities (id, external_source, external_id, user_id, organization_id, type, name, distance_m, moving_time_s, elapsed_time_s, average_pace_sec_km, average_hr, max_hr, elevation_gain_m, activity_date, raw_payload, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: admin_activation_invites; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.admin_activation_invites (id, organization_id, email, token, role, active, expires_at, accepted_at, invited_by, invitee_name, created_at) FROM stdin;
\.


--
-- Data for Name: athlete_profiles; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.athlete_profiles (id, user_id, organization_id, cpf, birth_date, gender, phone, city, state, weight_kg, height_cm, shirt_size, emergency_contact, created_at, athlete_status, signup_source, onboarding_completed_at) FROM stdin;
fadd6f3b-6c2d-4f97-8203-49b558dd0b45	47ea320e-6647-43c5-ac9d-641e2f9192ee	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	12345678901	\N	\N	48999990000	Florianopolis	SC	\N	\N	\N	\N	2026-04-25 19:24:50.408	ACTIVE	SLUG	\N
ff60efb6-f6e2-4cb5-a86e-52faf40c31be	2d5848fc-0d9b-4e77-b168-6ae8df4e8671	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	32165498700	\N	\N	48999990000	Curitiba	PR	\N	\N	\N	\N	2026-04-25 19:24:50.415	ACTIVE	SLUG	\N
a63b37e2-3e27-454e-8b42-d39cb8d3d749	91d07720-2cad-49a5-87c9-354ae8ddc6f7	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	98765432100	\N	\N	48999990000	Porto Alegre	RS	\N	\N	\N	\N	2026-04-25 19:24:50.418	ACTIVE	SLUG	\N
0b678cbb-9eaa-4f97-beb1-1ce1bb81a27c	a31cee6e-1cc4-4870-8494-155d8bd377de	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	45512233001	\N	\N	48999990000	Joinville	SC	\N	\N	\N	\N	2026-04-25 19:24:50.422	ACTIVE	SLUG	\N
79a2dcf2-994d-473f-ace0-66c9c4540c27	3ad6b486-705a-4a7c-978c-d9569b559368	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	45512233002	\N	\N	48999990000	Balneario Camboriu	SC	\N	\N	\N	\N	2026-04-25 19:24:50.425	ACTIVE	SLUG	\N
f3849085-1030-4165-bfaa-91b37b4f9377	7d7e7149-53f3-4a6d-a8f3-c18293b9e538	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	45512233003	\N	\N	48999990000	Curitiba	PR	\N	\N	\N	\N	2026-04-25 19:24:50.428	ACTIVE	SLUG	\N
3a933a90-ad0b-4bc4-a48e-32561ebd5bed	7b807652-bdf7-4453-8678-d3f103a20f67	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	45512233004	\N	\N	48999990000	Londrina	PR	\N	\N	\N	\N	2026-04-25 19:24:50.432	ACTIVE	SLUG	\N
2adab326-43a6-4c0c-befc-826d81bd08e2	9053267d-cb0c-4c12-bd3c-89f0a94100b4	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	45512233005	\N	\N	48999990000	Blumenau	SC	\N	\N	\N	\N	2026-04-25 19:24:50.435	ACTIVE	SLUG	\N
2d29f562-02db-43b5-9a77-75d3080f2071	3f57b36d-fb2f-4703-bc5d-70fb4514e5cd	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	45512233006	\N	\N	48999990000	Porto Alegre	RS	\N	\N	\N	\N	2026-04-25 19:24:50.439	ACTIVE	SLUG	\N
ea4f813a-186d-4220-9fae-ba7612a9f9ce	ca3cc538-43d4-4080-8589-05e75d1be12f	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	45512233007	\N	\N	48999990000	Caxias do Sul	RS	\N	\N	\N	\N	2026-04-25 19:24:50.442	ACTIVE	SLUG	\N
52084c8d-5e31-4e58-9e3e-10194c57d2ae	b07cc9e2-0fad-45d3-aa0d-7f96470b3bc9	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	45512233008	\N	\N	48999990000	Florianopolis	SC	\N	\N	\N	\N	2026-04-25 19:24:50.445	ACTIVE	SLUG	\N
a190904f-8263-43b9-a654-0aa87e8caeb4	8a4865ab-9474-4c4f-96c5-76c4d2c193e3	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	45512233009	\N	\N	48999990000	Curitiba	PR	\N	\N	\N	\N	2026-04-25 19:24:50.448	ACTIVE	SLUG	\N
\.


--
-- Data for Name: collective_members; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.collective_members (id, collective_signup_id, user_id, distance_id, payment_id, joined_at) FROM stdin;
\.


--
-- Data for Name: collective_signups; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.collective_signups (id, event_id, organization_id, created_by, name, status, deadline, max_members, created_at) FROM stdin;
\.


--
-- Data for Name: community_comments; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.community_comments (id, post_id, organization_id, user_id, text, created_at) FROM stdin;
678c619b-5df3-46d6-974f-195c5663c61d	354ccf4f-2304-48c3-a7d8-e60e334de221	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	47ea320e-6647-43c5-ac9d-641e2f9192ee	Top! Vou postar os treinos da semana por aqui.	2026-04-25 19:24:50.759
52359d2e-e1da-460f-aa23-44a75326fc65	354ccf4f-2304-48c3-a7d8-e60e334de221	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	2bc8e43e-93a1-4c0b-bc43-2b7a025a8dce	Perfeito. Vou usar esse canal para avisos técnicos.	2026-04-25 19:24:50.764
49228301-8e06-468d-bb5c-a8fe7e812262	b730786d-91fa-4999-aa55-175b5e06c44d	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	6eb9982d-a39c-489d-b8d6-d2dfe7e512e7	Excelente sessão. Domingo teremos equipe às 6h no parque.	2026-04-25 19:24:50.77
e1bc0b74-8b75-4ef6-8a10-e53580fed204	b730786d-91fa-4999-aa55-175b5e06c44d	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	91d07720-2cad-49a5-87c9-354ae8ddc6f7	Eu vou! Quero fechar 16km progressivo.	2026-04-25 19:24:50.773
f48a2912-a209-4a0f-980a-ce0056e41cbd	85172430-b9df-455b-9d9a-7fab0319de43	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	3ad6b486-705a-4a7c-978c-d9569b559368	Muito bom! Vamos manter o bloco para a meia.	2026-04-25 19:24:50.78
\.


--
-- Data for Name: community_posts; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.community_posts (id, organization_id, user_id, tab, content, created_at) FROM stdin;
354ccf4f-2304-48c3-a7d8-e60e334de221	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	6eb9982d-a39c-489d-b8d6-d2dfe7e512e7	Feed	Bem-vindos à comunidade Ventu Suli! Usem este espaço para compartilhar treinos, resultados e dúvidas.	2026-04-25 19:24:50.753
b730786d-91fa-4999-aa55-175b5e06c44d	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	47ea320e-6647-43c5-ac9d-641e2f9192ee	Treinos	Treino de limiar fechado hoje: 3x10min forte. Alguém vai no longão de domingo?	2026-04-25 19:24:50.767
85172430-b9df-455b-9d9a-7fab0319de43	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	2bc8e43e-93a1-4c0b-bc43-2b7a025a8dce	Resultados	Parabéns ao grupo: 11 novos PRs nas últimas 4 semanas. Consistência está fazendo diferença.	2026-04-25 19:24:50.777
\.


--
-- Data for Name: community_reactions; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.community_reactions (id, post_id, organization_id, user_id, type, created_at) FROM stdin;
\.


--
-- Data for Name: event_distances; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.event_distances (id, event_id, label, distance_km, price_cents, max_slots, registered_count) FROM stdin;
6b797dbd-8bce-4575-ad94-ca654bcb2be6	7bac6e60-85fd-40bd-8294-c3e7d45e3963	5K	5.000	9900	400	264
e61a600f-b548-47e0-a96c-8b23de0e2bda	7bac6e60-85fd-40bd-8294-c3e7d45e3963	10K	10.000	12900	300	219
64239b9e-1c54-4c25-b9ce-9fc40db9e585	a9919dcb-29d9-4de6-b786-15d2bd68b7f2	10K	10.000	13900	250	186
02718219-0192-41c7-81e0-0e0b3ea898cf	a9919dcb-29d9-4de6-b786-15d2bd68b7f2	21K	21.097	18900	200	171
e677f971-a6a2-468c-a7a9-435d30c53eac	23dcd68b-187b-4676-b688-43f854f3998f	5K	5.000	10900	500	293
d39c3216-279d-43e3-9c5a-57ce78cc6d21	23dcd68b-187b-4676-b688-43f854f3998f	10K	10.000	14900	400	337
14cc1ffc-7621-43cc-96dc-3a73e99faf45	23dcd68b-187b-4676-b688-43f854f3998f	21K	21.097	19900	300	248
604acc94-8c62-410c-88a5-d7c61b77507f	23dcd68b-187b-4676-b688-43f854f3998f	42K	42.195	25900	150	118
7b58bc3d-abb8-4b67-a6d3-312ddf7b47bf	b9bda6e5-9c34-4ade-9ff3-4338547f4e24	3K	3.000	7900	350	0
eec38824-d30d-4f6a-9abd-c127a6d2d46a	b9bda6e5-9c34-4ade-9ff3-4338547f4e24	6K	6.000	9900	300	0
f77b0edf-3aab-4d54-b39d-2406e8dd775f	979bfde7-98a3-4698-8a0a-1dfbc4f9f4ae	8K	8.000	11900	220	196
1d699c1a-19d7-40e5-b2be-5be6a57f6923	979bfde7-98a3-4698-8a0a-1dfbc4f9f4ae	16K	16.000	16900	180	157
e8223e8b-934b-45ac-8a05-47651fbb9aff	1b702467-4c53-43b4-9817-dedfedb9dcc4	5K	5.000	9900	350	241
dea6bdf3-dfe3-4cff-b234-8eb4b5fc7289	1b702467-4c53-43b4-9817-dedfedb9dcc4	10K	10.000	13900	280	204
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.events (id, organization_id, created_by, name, city, state, address, event_date, registration_deadline, description, image_url, external_url, status, created_at) FROM stdin;
7bac6e60-85fd-40bd-8294-c3e7d45e3963	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	6eb9982d-a39c-489d-b8d6-d2dfe7e512e7	Corrida da Ponte 2026	Florianopolis	SC	Avenida Beira-Mar Norte, 3000	2026-08-23 06:30:00	2026-08-10 23:59:59	Prova urbana com percurso rapido e clima de festival esportivo.	\N	https://example.com/corrida-da-ponte	PUBLISHED	2026-04-25 19:24:50.456
a9919dcb-29d9-4de6-b786-15d2bd68b7f2	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	6eb9982d-a39c-489d-b8d6-d2dfe7e512e7	Meia Maratona Serra Azul	Blumenau	SC	Parque Ramiro Rudiger	2026-09-20 05:45:00	2026-09-05 23:59:59	Altimetria desafiadora para atletas que buscam performance.	\N	https://example.com/meia-serra-azul	PUBLISHED	2026-04-25 19:24:50.477
23dcd68b-187b-4676-b688-43f854f3998f	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	6eb9982d-a39c-489d-b8d6-d2dfe7e512e7	Maratona Ventu Suli	Curitiba	PR	Parque Barigui	2026-11-15 05:30:00	2026-10-30 23:59:59	Festival com distancias para todos os niveis e area premium para assessorias.	\N	https://example.com/maratona-ventu-suli	PUBLISHED	2026-04-25 19:24:50.493
b9bda6e5-9c34-4ade-9ff3-4338547f4e24	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	6eb9982d-a39c-489d-b8d6-d2dfe7e512e7	Night Run Centro 2026	Florianopolis	SC	Praca XV de Novembro	2026-12-05 23:00:00	2026-11-28 23:59:59	Prova noturna com percursos curtos para alto engajamento da comunidade.	\N	https://example.com/night-run-centro	DRAFT	2026-04-25 19:24:50.515
979bfde7-98a3-4698-8a0a-1dfbc4f9f4ae	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	6eb9982d-a39c-489d-b8d6-d2dfe7e512e7	Trail Vale Europeu 2026	Pomerode	SC	Parque Municipal de Eventos	2026-07-12 07:00:00	2026-06-28 23:59:59	Trail com percursos tecnicos e visual de montanha.	\N	https://example.com/trail-vale-europeu	FINISHED	2026-04-25 19:24:50.529
1b702467-4c53-43b4-9817-dedfedb9dcc4	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	6eb9982d-a39c-489d-b8d6-d2dfe7e512e7	Circuito Litoral Sul 2026	Imbituba	SC	Avenida Beira Mar	2026-10-04 06:15:00	2026-09-24 23:59:59	Circuito de rua com foco em performance e experiencia de equipe.	\N	https://example.com/circuito-litoral-sul	PUBLISHED	2026-04-25 19:24:50.543
\.


--
-- Data for Name: notice_deliveries; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.notice_deliveries (id, notice_id, organization_id, channel, status, external_id, error_message, sent_at, created_at, updated_at, attempt_count, last_attempt_at) FROM stdin;
\.


--
-- Data for Name: notices; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.notices (id, organization_id, created_by, title, body, audience, status, pinned, publish_at, telegram_enabled, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organization_invites; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.organization_invites (id, organization_id, token, active, expires_at, max_uses, used_count, created_at, label) FROM stdin;
34c11827-959e-49b4-88bd-4e2edc70836e	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	VENTU-ATLETA-2026	t	\N	\N	0	2026-04-25 19:24:49.459	\N
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.organizations (id, name, slug, logo_url, plan, plan_expires_at, settings, created_at, status, setup_completed_at) FROM stdin;
abef2bc1-aa4b-48a1-8bc6-426ddb16d322	Ventu Suli Running Team	assessoria-ventu-demo	\N	PRO	\N	{"branding": {"slogan": "Performance com gestao inteligente", "primaryColor": "#F5A623", "supportEmail": "suporte@ventusuli.app"}, "allowAthleteSelfSignup": true, "requireAthleteApproval": false}	2026-04-25 19:23:47.181	PENDING_SETUP	\N
f0abd2ea-9e9a-461d-b5e4-c99345c115d5	Ventu Suli Platform	ventusuli-platform	\N	ENTERPRISE	\N	{"internal": true}	2026-04-25 19:23:47.197	PENDING_SETUP	\N
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.payments (id, registration_id, organization_id, amount_cents, paid_at, created_at, efi_charge_id, efi_tx_id, expires_at, fee_cents, net_cents, pix_key, qr_code_url, user_id, webhook_payload, status) FROM stdin;
b35ce611-ee5a-4ad4-b7e1-fc1070b441ce	35962a14-1999-4f69-8276-0aed2eba2443	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	12900	2026-07-28 12:25:00	2026-04-25 19:24:50.563	\N	VS-35962A1419994F6982760AED	\N	645	12255	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540129.005802BR5909VENTUSULI6009SAOPAULO62070503***63043596	47ea320e-6647-43c5-ac9d-641e2f9192ee	\N	PAID
967f1342-bae3-4516-be70-9cfe98ec21b3	2c7988d9-906e-44c6-9528-7c88fe25b817	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	9900	\N	2026-04-25 19:24:50.573	\N	VS-2C7988D9906E44C695287C88	2026-04-27 19:24:50.555	495	9405	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo52040000530398654099.005802BR5909VENTUSULI6009SAOPAULO62070503***63042C79	2d5848fc-0d9b-4e77-b168-6ae8df4e8671	\N	PENDING
2a83df1e-ab70-4015-8c70-60eaff675f4c	843b3983-cc1e-43aa-89bb-0e6cc909eedb	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	12900	2026-07-29 10:20:00	2026-04-25 19:24:50.581	\N	VS-843B3983CC1E43AA89BB0E6C	\N	645	12255	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540129.005802BR5909VENTUSULI6009SAOPAULO62070503***6304843B	91d07720-2cad-49a5-87c9-354ae8ddc6f7	\N	PAID
68793eda-157b-46ab-9a2f-3392a1cc0545	9fdc73b6-4559-4357-a643-1dd0921a96a5	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	9900	2026-07-30 08:35:00	2026-04-25 19:24:50.589	\N	VS-9FDC73B645594357A6431DD0	\N	495	9405	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo52040000530398654099.005802BR5909VENTUSULI6009SAOPAULO62070503***63049FDC	3ad6b486-705a-4a7c-978c-d9569b559368	\N	PAID
404c3c48-cdfe-4c70-a86f-0e1991fb5ec8	2cc816df-cf00-4511-b92c-6092bb0085f8	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	12900	\N	2026-04-25 19:24:50.596	\N	VS-2CC816DFCF004511B92C6092	2026-04-28 19:24:50.555	645	12255	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540129.005802BR5909VENTUSULI6009SAOPAULO62070503***63042CC8	7d7e7149-53f3-4a6d-a8f3-c18293b9e538	\N	PENDING
190d8377-a9e5-4e7d-9e7b-d8e5dbbcef9e	e8ec76c3-e1a8-4fb6-95e3-649627388379	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	18900	\N	2026-04-25 19:24:50.604	\N	VS-E8EC76C3E1A84FB695E36496	2026-04-26 19:24:50.555	945	17955	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540189.005802BR5909VENTUSULI6009SAOPAULO62070503***6304E8EC	47ea320e-6647-43c5-ac9d-641e2f9192ee	\N	PENDING
075904a5-6d09-4602-9223-62c9f2190277	44e5d82d-cb28-4dbd-9a43-2bdbde5f1e95	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	13900	\N	2026-04-25 19:24:50.612	\N	VS-44E5D82DCB284DBD9A432BDB	\N	695	13205	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540139.005802BR5909VENTUSULI6009SAOPAULO62070503***630444E5	2d5848fc-0d9b-4e77-b168-6ae8df4e8671	\N	CANCELLED
6a4eef2b-9c7a-482b-a5c4-35b085927682	ab1f7572-047b-43dc-a360-0e93d78b6267	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	18900	2026-08-18 14:00:00	2026-04-25 19:24:50.619	\N	VS-AB1F7572047B43DCA3600E93	\N	945	17955	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540189.005802BR5909VENTUSULI6009SAOPAULO62070503***6304AB1F	3f57b36d-fb2f-4703-bc5d-70fb4514e5cd	\N	PAID
09fe166e-e34d-4a04-bca8-f5425b46dc3e	a75499c1-bfb0-4e72-bf3e-fb1e2f94f6de	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	13900	2026-08-19 11:40:00	2026-04-25 19:24:50.627	\N	VS-A75499C1BFB04E72BF3EFB1E	\N	695	13205	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540139.005802BR5909VENTUSULI6009SAOPAULO62070503***6304A754	ca3cc538-43d4-4080-8589-05e75d1be12f	\N	PAID
ab6cc752-4dc6-45d9-b2a5-681655af96ff	9a001a8c-e690-41b3-a5f7-55dbf6f9c7b9	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	18900	\N	2026-04-25 19:24:50.633	\N	VS-9A001A8CE69041B3A5F755DB	2026-08-26 09:00:00	945	17955	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540189.005802BR5909VENTUSULI6009SAOPAULO62070503***63049A00	b07cc9e2-0fad-45d3-aa0d-7f96470b3bc9	\N	EXPIRED
345327bb-902e-422e-ab88-0671b4825c3d	8921316a-0555-4470-8a7f-bae37414f766	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	10900	2026-08-20 10:10:00	2026-04-25 19:24:50.64	\N	VS-8921316A055544708A7FBAE3	\N	545	10355	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540109.005802BR5909VENTUSULI6009SAOPAULO62070503***63048921	91d07720-2cad-49a5-87c9-354ae8ddc6f7	\N	PAID
ef6ec898-937a-477f-b7db-92eba61df133	5e71a6b4-0451-4ef2-a275-c27dd6424ac2	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	19900	\N	2026-04-25 19:24:50.646	\N	VS-5E71A6B404514EF2A275C27D	2026-08-26 09:00:00	995	18905	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540199.005802BR5909VENTUSULI6009SAOPAULO62070503***63045E71	2d5848fc-0d9b-4e77-b168-6ae8df4e8671	\N	EXPIRED
9bc11922-278e-4140-9ee8-ff507b63253e	71c1a468-1d57-4c81-b239-1aa18bd8b0a2	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	25900	2026-08-22 11:45:00	2026-04-25 19:24:50.653	\N	VS-71C1A4681D574C81B2391AA1	\N	1295	24605	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540259.005802BR5909VENTUSULI6009SAOPAULO62070503***630471C1	47ea320e-6647-43c5-ac9d-641e2f9192ee	\N	PAID
f6016ec1-bc81-45f0-81bb-406b176d2f96	164cf7f8-9b45-4673-b6e4-35b6a3ebb8aa	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	14900	2026-08-23 09:30:00	2026-04-25 19:24:50.659	\N	VS-164CF7F89B454673B6E435B6	\N	745	14155	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540149.005802BR5909VENTUSULI6009SAOPAULO62070503***6304164C	a31cee6e-1cc4-4870-8494-155d8bd377de	\N	PAID
cad405ac-aad1-4dac-8478-5e9b91d10324	0bd23e0e-532b-42d0-9b4a-5a2650a0f222	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	19900	2026-08-23 13:10:00	2026-04-25 19:24:50.665	\N	VS-0BD23E0E532B42D09B4A5A26	\N	995	18905	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540199.005802BR5909VENTUSULI6009SAOPAULO62070503***63040BD2	3ad6b486-705a-4a7c-978c-d9569b559368	\N	REFUNDED
1159974e-d7bf-4b82-b21c-8afc6de5e800	aeb07097-2a38-4aa5-ae7d-8537b35a4189	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	10900	\N	2026-04-25 19:24:50.672	\N	VS-AEB070972A384AA5AE7D8537	2026-04-27 07:24:50.555	545	10355	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540109.005802BR5909VENTUSULI6009SAOPAULO62070503***6304AEB0	7d7e7149-53f3-4a6d-a8f3-c18293b9e538	\N	PENDING
8f307341-46fb-4dca-b7c6-9034e7416725	8e5bf7b8-587a-4216-8247-ca39d6cf632e	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	19900	2026-08-24 10:55:00	2026-04-25 19:24:50.679	\N	VS-8E5BF7B8587A42168247CA39	\N	995	18905	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540199.005802BR5909VENTUSULI6009SAOPAULO62070503***63048E5B	7b807652-bdf7-4453-8678-d3f103a20f67	\N	PAID
4630aab0-c8f3-48d5-8f82-04b6df267e42	fe7f1fa6-8429-4994-bb46-74180b50e034	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	14900	2026-08-24 14:05:00	2026-04-25 19:24:50.686	\N	VS-FE7F1FA684294994BB467418	\N	745	14155	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540149.005802BR5909VENTUSULI6009SAOPAULO62070503***6304FE7F	9053267d-cb0c-4c12-bd3c-89f0a94100b4	\N	PAID
933d390e-f27a-4051-aedf-68a5f84c32d9	f7eb35ed-b8ed-41bd-b38b-2d15ac11ccc0	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	25900	\N	2026-04-25 19:24:50.694	\N	VS-F7EB35EDB8ED41BDB38B2D15	2026-04-29 19:24:50.555	1295	24605	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540259.005802BR5909VENTUSULI6009SAOPAULO62070503***6304F7EB	3f57b36d-fb2f-4703-bc5d-70fb4514e5cd	\N	PENDING
f34bd553-3a70-4aa7-9b27-c7014f457ff3	b4c025f7-3dca-4678-8c05-b98bc6bc43fd	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	16900	2026-06-20 16:40:00	2026-04-25 19:24:50.702	\N	VS-B4C025F73DCA46788C05B98B	\N	845	16055	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540169.005802BR5909VENTUSULI6009SAOPAULO62070503***6304B4C0	ca3cc538-43d4-4080-8589-05e75d1be12f	\N	PAID
a6879f51-85ff-4809-8120-4e45adad4ebd	c8dbd555-7f50-4ec6-b553-454bbdb8c53b	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	11900	2026-06-21 09:45:00	2026-04-25 19:24:50.709	\N	VS-C8DBD5557F504EC6B553454B	\N	595	11305	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540119.005802BR5909VENTUSULI6009SAOPAULO62070503***6304C8DB	b07cc9e2-0fad-45d3-aa0d-7f96470b3bc9	\N	PAID
350915ed-992c-4c56-9ddc-cd19f8cece0e	c8dd6f57-03c7-4d46-926d-4f2971f1d217	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	11900	\N	2026-04-25 19:24:50.715	\N	VS-C8DD6F5703C74D46926D4F29	\N	595	11305	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540119.005802BR5909VENTUSULI6009SAOPAULO62070503***6304C8DD	8a4865ab-9474-4c4f-96c5-76c4d2c193e3	\N	CANCELLED
25532ce4-2088-4f8e-bb4e-6925714759ba	58814684-24e8-4436-8adc-2853c2b71ed6	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	13900	2026-09-10 17:30:00	2026-04-25 19:24:50.721	\N	VS-5881468424E844368ADC2853	\N	695	13205	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540139.005802BR5909VENTUSULI6009SAOPAULO62070503***63045881	91d07720-2cad-49a5-87c9-354ae8ddc6f7	\N	PAID
1b94ed8d-0472-4cc7-928f-36ed3faaa675	0453d624-612a-481c-84d8-25db21a47482	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	9900	2026-09-11 12:15:00	2026-04-25 19:24:50.727	\N	VS-0453D624612A481C84D825DB	\N	495	9405	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo52040000530398654099.005802BR5909VENTUSULI6009SAOPAULO62070503***63040453	47ea320e-6647-43c5-ac9d-641e2f9192ee	\N	PAID
0656203d-94a2-4929-8ceb-f893070f55de	5000c97c-103e-4b4e-b015-06ab6271c32e	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	13900	\N	2026-04-25 19:24:50.733	\N	VS-5000C97C103E4B4EB01506AB	2026-04-28 07:24:50.555	695	13205	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540139.005802BR5909VENTUSULI6009SAOPAULO62070503***63045000	3ad6b486-705a-4a7c-978c-d9569b559368	\N	PENDING
162e3fa2-23b2-4844-84bd-3afe00ab4043	26e5b74d-7111-474f-a248-7f8649a93a8c	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	9900	2026-09-12 09:55:00	2026-04-25 19:24:50.739	\N	VS-26E5B74D7111474FA2487F86	\N	495	9405	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo52040000530398654099.005802BR5909VENTUSULI6009SAOPAULO62070503***630426E5	9053267d-cb0c-4c12-bd3c-89f0a94100b4	\N	PAID
4567ffb4-161d-4430-bbcb-9801132625bc	ea9fbc95-e2d9-43d8-8584-dda13e9cd8de	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	13900	\N	2026-04-25 19:24:50.745	\N	VS-EA9FBC95E2D943D88584DDA1	2026-09-20 09:00:00	695	13205	financeiro@ventusuli.demo	00020126580014BR.GOV.BCB.PIX0136financeiro@ventusuli.demo520400005303986540139.005802BR5909VENTUSULI6009SAOPAULO62070503***6304EA9F	3f57b36d-fb2f-4703-bc5d-70fb4514e5cd	\N	EXPIRED
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.refresh_tokens (id, user_id, organization_id, token_hash, expires_at, revoked, created_at) FROM stdin;
\.


--
-- Data for Name: registrations; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.registrations (id, user_id, event_id, distance_id, organization_id, status, notes, registered_at) FROM stdin;
35962a14-1999-4f69-8276-0aed2eba2443	47ea320e-6647-43c5-ac9d-641e2f9192ee	7bac6e60-85fd-40bd-8294-c3e7d45e3963	e61a600f-b548-47e0-a96c-8b23de0e2bda	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.556
2c7988d9-906e-44c6-9528-7c88fe25b817	2d5848fc-0d9b-4e77-b168-6ae8df4e8671	7bac6e60-85fd-40bd-8294-c3e7d45e3963	6b797dbd-8bce-4575-ad94-ca654bcb2be6	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	PENDING_PAYMENT	\N	2026-04-25 19:24:50.569
843b3983-cc1e-43aa-89bb-0e6cc909eedb	91d07720-2cad-49a5-87c9-354ae8ddc6f7	7bac6e60-85fd-40bd-8294-c3e7d45e3963	e61a600f-b548-47e0-a96c-8b23de0e2bda	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.577
9fdc73b6-4559-4357-a643-1dd0921a96a5	3ad6b486-705a-4a7c-978c-d9569b559368	7bac6e60-85fd-40bd-8294-c3e7d45e3963	6b797dbd-8bce-4575-ad94-ca654bcb2be6	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.585
2cc816df-cf00-4511-b92c-6092bb0085f8	7d7e7149-53f3-4a6d-a8f3-c18293b9e538	7bac6e60-85fd-40bd-8294-c3e7d45e3963	e61a600f-b548-47e0-a96c-8b23de0e2bda	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	PENDING_PAYMENT	\N	2026-04-25 19:24:50.593
e8ec76c3-e1a8-4fb6-95e3-649627388379	47ea320e-6647-43c5-ac9d-641e2f9192ee	a9919dcb-29d9-4de6-b786-15d2bd68b7f2	02718219-0192-41c7-81e0-0e0b3ea898cf	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	PENDING_PAYMENT	\N	2026-04-25 19:24:50.601
44e5d82d-cb28-4dbd-9a43-2bdbde5f1e95	2d5848fc-0d9b-4e77-b168-6ae8df4e8671	a9919dcb-29d9-4de6-b786-15d2bd68b7f2	64239b9e-1c54-4c25-b9ce-9fc40db9e585	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CANCELLED	\N	2026-04-25 19:24:50.609
ab1f7572-047b-43dc-a360-0e93d78b6267	3f57b36d-fb2f-4703-bc5d-70fb4514e5cd	a9919dcb-29d9-4de6-b786-15d2bd68b7f2	02718219-0192-41c7-81e0-0e0b3ea898cf	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.616
a75499c1-bfb0-4e72-bf3e-fb1e2f94f6de	ca3cc538-43d4-4080-8589-05e75d1be12f	a9919dcb-29d9-4de6-b786-15d2bd68b7f2	64239b9e-1c54-4c25-b9ce-9fc40db9e585	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.623
9a001a8c-e690-41b3-a5f7-55dbf6f9c7b9	b07cc9e2-0fad-45d3-aa0d-7f96470b3bc9	a9919dcb-29d9-4de6-b786-15d2bd68b7f2	02718219-0192-41c7-81e0-0e0b3ea898cf	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	PENDING_PAYMENT	\N	2026-04-25 19:24:50.63
8921316a-0555-4470-8a7f-bae37414f766	91d07720-2cad-49a5-87c9-354ae8ddc6f7	23dcd68b-187b-4676-b688-43f854f3998f	e677f971-a6a2-468c-a7a9-435d30c53eac	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.637
5e71a6b4-0451-4ef2-a275-c27dd6424ac2	2d5848fc-0d9b-4e77-b168-6ae8df4e8671	23dcd68b-187b-4676-b688-43f854f3998f	14cc1ffc-7621-43cc-96dc-3a73e99faf45	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	PENDING_PAYMENT	\N	2026-04-25 19:24:50.644
71c1a468-1d57-4c81-b239-1aa18bd8b0a2	47ea320e-6647-43c5-ac9d-641e2f9192ee	23dcd68b-187b-4676-b688-43f854f3998f	604acc94-8c62-410c-88a5-d7c61b77507f	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.65
164cf7f8-9b45-4673-b6e4-35b6a3ebb8aa	a31cee6e-1cc4-4870-8494-155d8bd377de	23dcd68b-187b-4676-b688-43f854f3998f	d39c3216-279d-43e3-9c5a-57ce78cc6d21	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.656
0bd23e0e-532b-42d0-9b4a-5a2650a0f222	3ad6b486-705a-4a7c-978c-d9569b559368	23dcd68b-187b-4676-b688-43f854f3998f	14cc1ffc-7621-43cc-96dc-3a73e99faf45	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.662
aeb07097-2a38-4aa5-ae7d-8537b35a4189	7d7e7149-53f3-4a6d-a8f3-c18293b9e538	23dcd68b-187b-4676-b688-43f854f3998f	e677f971-a6a2-468c-a7a9-435d30c53eac	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	PENDING_PAYMENT	\N	2026-04-25 19:24:50.669
8e5bf7b8-587a-4216-8247-ca39d6cf632e	7b807652-bdf7-4453-8678-d3f103a20f67	23dcd68b-187b-4676-b688-43f854f3998f	14cc1ffc-7621-43cc-96dc-3a73e99faf45	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.675
fe7f1fa6-8429-4994-bb46-74180b50e034	9053267d-cb0c-4c12-bd3c-89f0a94100b4	23dcd68b-187b-4676-b688-43f854f3998f	d39c3216-279d-43e3-9c5a-57ce78cc6d21	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.682
f7eb35ed-b8ed-41bd-b38b-2d15ac11ccc0	3f57b36d-fb2f-4703-bc5d-70fb4514e5cd	23dcd68b-187b-4676-b688-43f854f3998f	604acc94-8c62-410c-88a5-d7c61b77507f	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	PENDING_PAYMENT	\N	2026-04-25 19:24:50.691
b4c025f7-3dca-4678-8c05-b98bc6bc43fd	ca3cc538-43d4-4080-8589-05e75d1be12f	979bfde7-98a3-4698-8a0a-1dfbc4f9f4ae	1d699c1a-19d7-40e5-b2be-5be6a57f6923	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.697
c8dbd555-7f50-4ec6-b553-454bbdb8c53b	b07cc9e2-0fad-45d3-aa0d-7f96470b3bc9	979bfde7-98a3-4698-8a0a-1dfbc4f9f4ae	f77b0edf-3aab-4d54-b39d-2406e8dd775f	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.706
c8dd6f57-03c7-4d46-926d-4f2971f1d217	8a4865ab-9474-4c4f-96c5-76c4d2c193e3	979bfde7-98a3-4698-8a0a-1dfbc4f9f4ae	f77b0edf-3aab-4d54-b39d-2406e8dd775f	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CANCELLED	\N	2026-04-25 19:24:50.712
58814684-24e8-4436-8adc-2853c2b71ed6	91d07720-2cad-49a5-87c9-354ae8ddc6f7	1b702467-4c53-43b4-9817-dedfedb9dcc4	dea6bdf3-dfe3-4cff-b234-8eb4b5fc7289	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.719
0453d624-612a-481c-84d8-25db21a47482	47ea320e-6647-43c5-ac9d-641e2f9192ee	1b702467-4c53-43b4-9817-dedfedb9dcc4	e8223e8b-934b-45ac-8a05-47651fbb9aff	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.724
5000c97c-103e-4b4e-b015-06ab6271c32e	3ad6b486-705a-4a7c-978c-d9569b559368	1b702467-4c53-43b4-9817-dedfedb9dcc4	dea6bdf3-dfe3-4cff-b234-8eb4b5fc7289	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	PENDING_PAYMENT	\N	2026-04-25 19:24:50.73
26e5b74d-7111-474f-a248-7f8649a93a8c	9053267d-cb0c-4c12-bd3c-89f0a94100b4	1b702467-4c53-43b4-9817-dedfedb9dcc4	e8223e8b-934b-45ac-8a05-47651fbb9aff	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	CONFIRMED	\N	2026-04-25 19:24:50.736
ea9fbc95-e2d9-43d8-8584-dda13e9cd8de	3f57b36d-fb2f-4703-bc5d-70fb4514e5cd	1b702467-4c53-43b4-9817-dedfedb9dcc4	dea6bdf3-dfe3-4cff-b234-8eb4b5fc7289	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	PENDING_PAYMENT	\N	2026-04-25 19:24:50.742
\.


--
-- Data for Name: strava_connections; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.strava_connections (id, user_id, organization_id, strava_athlete_id, access_token, refresh_token, expires_at, scopes, last_sync_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: strava_sync_logs; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.strava_sync_logs (id, organization_id, user_id, strava_athlete_id, trigger, status, idempotency_key, object_type, aspect_type, object_id, subscription_id, event_time, payload, sync_result, error_message, created_at, processed_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: ventusuli
--

COPY public.users (id, organization_id, email, password_hash, role, name, avatar_url, email_verified, last_login_at, created_at, account_status) FROM stdin;
c812bf66-6c26-4ddc-9ea4-256839feeb84	f0abd2ea-9e9a-461d-b5e4-c99345c115d5	admin@sistema.ventusuli.com.br	$2b$12$UO7tzw9o5p.6twziF2kRH.pLQa8bS/fEf/mLSkLz/rxoRxBoUym/W	SUPER_ADMIN	Ventu Suli Super Admin	\N	t	\N	2026-04-25 19:23:47.658	ACTIVE
6eb9982d-a39c-489d-b8d6-d2dfe7e512e7	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	admin@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ADMIN	Carla Menezes	\N	t	\N	2026-04-25 19:24:50.353	ACTIVE
2bc8e43e-93a1-4c0b-bc43-2b7a025a8dce	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	coach@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	COACH	Rafael Torres	\N	t	\N	2026-04-25 19:24:50.358	ACTIVE
47ea320e-6647-43c5-ac9d-641e2f9192ee	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	atleta@ventu.demo	$2b$12$czJYm3jW.WUmdyhoG.npruZSCYgtVMh6Qv0wH0lRROE67Mp2rSLme	ATHLETE	Marina Oliveira	\N	t	\N	2026-04-25 19:24:50.362	ACTIVE
2d5848fc-0d9b-4e77-b168-6ae8df4e8671	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	lucas@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ATHLETE	Lucas Andrade	\N	t	\N	2026-04-25 19:24:50.366	ACTIVE
91d07720-2cad-49a5-87c9-354ae8ddc6f7	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	ana@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ATHLETE	Ana Beatriz	\N	t	\N	2026-04-25 19:24:50.37	ACTIVE
a31cee6e-1cc4-4870-8494-155d8bd377de	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	thiago@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ATHLETE	Thiago Mendes	\N	t	\N	2026-04-25 19:24:50.374	ACTIVE
3ad6b486-705a-4a7c-978c-d9569b559368	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	paula@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ATHLETE	Paula Ferreira	\N	t	\N	2026-04-25 19:24:50.378	ACTIVE
7d7e7149-53f3-4a6d-a8f3-c18293b9e538	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	bruno@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ATHLETE	Bruno Lima	\N	t	\N	2026-04-25 19:24:50.381	ACTIVE
7b807652-bdf7-4453-8678-d3f103a20f67	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	juliana@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ATHLETE	Juliana Prado	\N	t	\N	2026-04-25 19:24:50.385	ACTIVE
9053267d-cb0c-4c12-bd3c-89f0a94100b4	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	renato@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ATHLETE	Renato Souza	\N	t	\N	2026-04-25 19:24:50.389	ACTIVE
3f57b36d-fb2f-4703-bc5d-70fb4514e5cd	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	camila@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ATHLETE	Camila Costa	\N	t	\N	2026-04-25 19:24:50.393	ACTIVE
ca3cc538-43d4-4080-8589-05e75d1be12f	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	danilo@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ATHLETE	Danilo Vieira	\N	t	\N	2026-04-25 19:24:50.397	ACTIVE
b07cc9e2-0fad-45d3-aa0d-7f96470b3bc9	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	fernanda@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ATHLETE	Fernanda Rocha	\N	t	\N	2026-04-25 19:24:50.401	ACTIVE
8a4865ab-9474-4c4f-96c5-76c4d2c193e3	abef2bc1-aa4b-48a1-8bc6-426ddb16d322	patricia@ventu.demo	$2b$12$exWr8laFnFB1p6RRngow/e/cqpNtlDTKcDo2hUrTBbhJKXcqgDnMm	ATHLETE	Patricia Ramos	\N	t	\N	2026-04-25 19:24:50.404	ACTIVE
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: admin_activation_invites admin_activation_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.admin_activation_invites
    ADD CONSTRAINT admin_activation_invites_pkey PRIMARY KEY (id);


--
-- Name: athlete_profiles athlete_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.athlete_profiles
    ADD CONSTRAINT athlete_profiles_pkey PRIMARY KEY (id);


--
-- Name: collective_members collective_members_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.collective_members
    ADD CONSTRAINT collective_members_pkey PRIMARY KEY (id);


--
-- Name: collective_signups collective_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.collective_signups
    ADD CONSTRAINT collective_signups_pkey PRIMARY KEY (id);


--
-- Name: community_comments community_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.community_comments
    ADD CONSTRAINT community_comments_pkey PRIMARY KEY (id);


--
-- Name: community_posts community_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_pkey PRIMARY KEY (id);


--
-- Name: community_reactions community_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.community_reactions
    ADD CONSTRAINT community_reactions_pkey PRIMARY KEY (id);


--
-- Name: event_distances event_distances_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.event_distances
    ADD CONSTRAINT event_distances_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: notice_deliveries notice_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.notice_deliveries
    ADD CONSTRAINT notice_deliveries_pkey PRIMARY KEY (id);


--
-- Name: notices notices_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_pkey PRIMARY KEY (id);


--
-- Name: organization_invites organization_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.organization_invites
    ADD CONSTRAINT organization_invites_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: registrations registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_pkey PRIMARY KEY (id);


--
-- Name: strava_connections strava_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.strava_connections
    ADD CONSTRAINT strava_connections_pkey PRIMARY KEY (id);


--
-- Name: strava_sync_logs strava_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.strava_sync_logs
    ADD CONSTRAINT strava_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: activities_external_source_external_id_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX activities_external_source_external_id_key ON public.activities USING btree (external_source, external_id);


--
-- Name: activities_organization_id_user_id_activity_date_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX activities_organization_id_user_id_activity_date_idx ON public.activities USING btree (organization_id, user_id, activity_date DESC);


--
-- Name: activities_user_id_activity_date_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX activities_user_id_activity_date_idx ON public.activities USING btree (user_id, activity_date DESC);


--
-- Name: admin_activation_invites_email_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX admin_activation_invites_email_idx ON public.admin_activation_invites USING btree (email);


--
-- Name: admin_activation_invites_organization_id_active_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX admin_activation_invites_organization_id_active_idx ON public.admin_activation_invites USING btree (organization_id, active);


--
-- Name: admin_activation_invites_token_active_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX admin_activation_invites_token_active_idx ON public.admin_activation_invites USING btree (token, active);


--
-- Name: admin_activation_invites_token_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX admin_activation_invites_token_key ON public.admin_activation_invites USING btree (token);


--
-- Name: athlete_profiles_cpf_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX athlete_profiles_cpf_idx ON public.athlete_profiles USING btree (cpf);


--
-- Name: athlete_profiles_organization_id_athlete_status_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX athlete_profiles_organization_id_athlete_status_idx ON public.athlete_profiles USING btree (organization_id, athlete_status);


--
-- Name: athlete_profiles_organization_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX athlete_profiles_organization_id_idx ON public.athlete_profiles USING btree (organization_id);


--
-- Name: athlete_profiles_organization_id_signup_source_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX athlete_profiles_organization_id_signup_source_idx ON public.athlete_profiles USING btree (organization_id, signup_source);


--
-- Name: athlete_profiles_user_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX athlete_profiles_user_id_idx ON public.athlete_profiles USING btree (user_id);


--
-- Name: athlete_profiles_user_id_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX athlete_profiles_user_id_key ON public.athlete_profiles USING btree (user_id);


--
-- Name: collective_members_collective_signup_id_user_id_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX collective_members_collective_signup_id_user_id_key ON public.collective_members USING btree (collective_signup_id, user_id);


--
-- Name: collective_members_distance_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX collective_members_distance_id_idx ON public.collective_members USING btree (distance_id);


--
-- Name: collective_members_payment_id_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX collective_members_payment_id_key ON public.collective_members USING btree (payment_id);


--
-- Name: collective_members_user_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX collective_members_user_id_idx ON public.collective_members USING btree (user_id);


--
-- Name: collective_signups_event_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX collective_signups_event_id_idx ON public.collective_signups USING btree (event_id);


--
-- Name: collective_signups_organization_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX collective_signups_organization_id_idx ON public.collective_signups USING btree (organization_id);


--
-- Name: collective_signups_status_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX collective_signups_status_idx ON public.collective_signups USING btree (status);


--
-- Name: community_comments_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX community_comments_organization_id_created_at_idx ON public.community_comments USING btree (organization_id, created_at DESC);


--
-- Name: community_comments_post_id_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX community_comments_post_id_created_at_idx ON public.community_comments USING btree (post_id, created_at);


--
-- Name: community_comments_user_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX community_comments_user_id_idx ON public.community_comments USING btree (user_id);


--
-- Name: community_posts_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX community_posts_organization_id_created_at_idx ON public.community_posts USING btree (organization_id, created_at DESC);


--
-- Name: community_posts_user_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX community_posts_user_id_idx ON public.community_posts USING btree (user_id);


--
-- Name: community_reactions_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX community_reactions_organization_id_created_at_idx ON public.community_reactions USING btree (organization_id, created_at DESC);


--
-- Name: community_reactions_post_id_type_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX community_reactions_post_id_type_idx ON public.community_reactions USING btree (post_id, type);


--
-- Name: community_reactions_post_id_user_id_type_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX community_reactions_post_id_user_id_type_key ON public.community_reactions USING btree (post_id, user_id, type);


--
-- Name: community_reactions_user_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX community_reactions_user_id_idx ON public.community_reactions USING btree (user_id);


--
-- Name: event_distances_event_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX event_distances_event_id_idx ON public.event_distances USING btree (event_id);


--
-- Name: events_event_date_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX events_event_date_idx ON public.events USING btree (event_date);


--
-- Name: events_organization_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX events_organization_id_idx ON public.events USING btree (organization_id);


--
-- Name: events_organization_id_status_event_date_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX events_organization_id_status_event_date_idx ON public.events USING btree (organization_id, status, event_date);


--
-- Name: events_status_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX events_status_idx ON public.events USING btree (status);


--
-- Name: notice_deliveries_notice_id_channel_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX notice_deliveries_notice_id_channel_key ON public.notice_deliveries USING btree (notice_id, channel);


--
-- Name: notice_deliveries_organization_id_channel_status_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX notice_deliveries_organization_id_channel_status_idx ON public.notice_deliveries USING btree (organization_id, channel, status);


--
-- Name: notice_deliveries_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX notice_deliveries_organization_id_created_at_idx ON public.notice_deliveries USING btree (organization_id, created_at DESC);


--
-- Name: notice_deliveries_sent_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX notice_deliveries_sent_at_idx ON public.notice_deliveries USING btree (sent_at DESC);


--
-- Name: notices_created_by_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX notices_created_by_created_at_idx ON public.notices USING btree (created_by, created_at DESC);


--
-- Name: notices_organization_id_status_pinned_publish_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX notices_organization_id_status_pinned_publish_at_idx ON public.notices USING btree (organization_id, status, pinned, publish_at DESC);


--
-- Name: organization_invites_organization_id_active_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX organization_invites_organization_id_active_idx ON public.organization_invites USING btree (organization_id, active);


--
-- Name: organization_invites_token_active_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX organization_invites_token_active_idx ON public.organization_invites USING btree (token, active);


--
-- Name: organization_invites_token_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX organization_invites_token_key ON public.organization_invites USING btree (token);


--
-- Name: organizations_slug_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX organizations_slug_idx ON public.organizations USING btree (slug);


--
-- Name: organizations_slug_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX organizations_slug_key ON public.organizations USING btree (slug);


--
-- Name: organizations_status_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX organizations_status_idx ON public.organizations USING btree (status);


--
-- Name: password_reset_tokens_expires_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX password_reset_tokens_expires_at_idx ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: password_reset_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX password_reset_tokens_token_hash_key ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: password_reset_tokens_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX password_reset_tokens_user_id_created_at_idx ON public.password_reset_tokens USING btree (user_id, created_at DESC);


--
-- Name: payments_efi_charge_id_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX payments_efi_charge_id_key ON public.payments USING btree (efi_charge_id);


--
-- Name: payments_efi_tx_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX payments_efi_tx_id_idx ON public.payments USING btree (efi_tx_id);


--
-- Name: payments_efi_tx_id_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX payments_efi_tx_id_key ON public.payments USING btree (efi_tx_id);


--
-- Name: payments_organization_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX payments_organization_id_idx ON public.payments USING btree (organization_id);


--
-- Name: payments_organization_id_status_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX payments_organization_id_status_created_at_idx ON public.payments USING btree (organization_id, status, created_at);


--
-- Name: payments_registration_id_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX payments_registration_id_key ON public.payments USING btree (registration_id);


--
-- Name: payments_status_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX payments_status_idx ON public.payments USING btree (status);


--
-- Name: payments_user_id_status_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX payments_user_id_status_created_at_idx ON public.payments USING btree (user_id, status, created_at);


--
-- Name: refresh_tokens_expires_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX refresh_tokens_expires_at_idx ON public.refresh_tokens USING btree (expires_at);


--
-- Name: refresh_tokens_organization_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX refresh_tokens_organization_id_idx ON public.refresh_tokens USING btree (organization_id);


--
-- Name: refresh_tokens_token_hash_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX refresh_tokens_token_hash_idx ON public.refresh_tokens USING btree (token_hash);


--
-- Name: refresh_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens USING btree (token_hash);


--
-- Name: refresh_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX refresh_tokens_user_id_idx ON public.refresh_tokens USING btree (user_id);


--
-- Name: registrations_organization_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX registrations_organization_id_idx ON public.registrations USING btree (organization_id);


--
-- Name: registrations_organization_id_status_registered_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX registrations_organization_id_status_registered_at_idx ON public.registrations USING btree (organization_id, status, registered_at);


--
-- Name: registrations_user_id_event_id_distance_id_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX registrations_user_id_event_id_distance_id_key ON public.registrations USING btree (user_id, event_id, distance_id);


--
-- Name: registrations_user_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX registrations_user_id_idx ON public.registrations USING btree (user_id);


--
-- Name: strava_connections_organization_id_strava_athlete_id_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX strava_connections_organization_id_strava_athlete_id_key ON public.strava_connections USING btree (organization_id, strava_athlete_id);


--
-- Name: strava_connections_organization_id_updated_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX strava_connections_organization_id_updated_at_idx ON public.strava_connections USING btree (organization_id, updated_at DESC);


--
-- Name: strava_connections_user_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX strava_connections_user_id_idx ON public.strava_connections USING btree (user_id);


--
-- Name: strava_connections_user_id_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX strava_connections_user_id_key ON public.strava_connections USING btree (user_id);


--
-- Name: strava_sync_logs_idempotency_key_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX strava_sync_logs_idempotency_key_key ON public.strava_sync_logs USING btree (idempotency_key);


--
-- Name: strava_sync_logs_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX strava_sync_logs_organization_id_created_at_idx ON public.strava_sync_logs USING btree (organization_id, created_at DESC);


--
-- Name: strava_sync_logs_status_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX strava_sync_logs_status_created_at_idx ON public.strava_sync_logs USING btree (status, created_at DESC);


--
-- Name: strava_sync_logs_strava_athlete_id_created_at_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX strava_sync_logs_strava_athlete_id_created_at_idx ON public.strava_sync_logs USING btree (strava_athlete_id, created_at DESC);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_organization_id_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX users_organization_id_idx ON public.users USING btree (organization_id);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: ventusuli
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: activities activities_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: activities activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: admin_activation_invites admin_activation_invites_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.admin_activation_invites
    ADD CONSTRAINT admin_activation_invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: athlete_profiles athlete_profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.athlete_profiles
    ADD CONSTRAINT athlete_profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: athlete_profiles athlete_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.athlete_profiles
    ADD CONSTRAINT athlete_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: collective_members collective_members_collective_signup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.collective_members
    ADD CONSTRAINT collective_members_collective_signup_id_fkey FOREIGN KEY (collective_signup_id) REFERENCES public.collective_signups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: collective_members collective_members_distance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.collective_members
    ADD CONSTRAINT collective_members_distance_id_fkey FOREIGN KEY (distance_id) REFERENCES public.event_distances(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: collective_members collective_members_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.collective_members
    ADD CONSTRAINT collective_members_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: collective_members collective_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.collective_members
    ADD CONSTRAINT collective_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: collective_signups collective_signups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.collective_signups
    ADD CONSTRAINT collective_signups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: collective_signups collective_signups_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.collective_signups
    ADD CONSTRAINT collective_signups_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: collective_signups collective_signups_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.collective_signups
    ADD CONSTRAINT collective_signups_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_comments community_comments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.community_comments
    ADD CONSTRAINT community_comments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_comments community_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.community_comments
    ADD CONSTRAINT community_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_comments community_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.community_comments
    ADD CONSTRAINT community_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_posts community_posts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_posts community_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_reactions community_reactions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.community_reactions
    ADD CONSTRAINT community_reactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_reactions community_reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.community_reactions
    ADD CONSTRAINT community_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: community_reactions community_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.community_reactions
    ADD CONSTRAINT community_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: event_distances event_distances_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.event_distances
    ADD CONSTRAINT event_distances_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: events events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notice_deliveries notice_deliveries_notice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.notice_deliveries
    ADD CONSTRAINT notice_deliveries_notice_id_fkey FOREIGN KEY (notice_id) REFERENCES public.notices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notice_deliveries notice_deliveries_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.notice_deliveries
    ADD CONSTRAINT notice_deliveries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notices notices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notices notices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: organization_invites organization_invites_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.organization_invites
    ADD CONSTRAINT organization_invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payments payments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payments payments_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: registrations registrations_distance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_distance_id_fkey FOREIGN KEY (distance_id) REFERENCES public.event_distances(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: registrations registrations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: registrations registrations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: registrations registrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: strava_connections strava_connections_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.strava_connections
    ADD CONSTRAINT strava_connections_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: strava_connections strava_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.strava_connections
    ADD CONSTRAINT strava_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: strava_sync_logs strava_sync_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.strava_sync_logs
    ADD CONSTRAINT strava_sync_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: strava_sync_logs strava_sync_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.strava_sync_logs
    ADD CONSTRAINT strava_sync_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ventusuli
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Laf3c4pKCTuiQW8NaRKjxtB9gvlP1JagRVBLrdhPGpvx3xHRngBEq3C0B7AlgB2

