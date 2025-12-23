--
-- PostgreSQL database dump
--

\restrict WdS6NjKgbRD7dkXRn8OUf1ZjoXac44cjfLFH9zYSZLYmMiusvBNzVfZqrUjXgdS

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: shapetype; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.shapetype AS ENUM (
    'circular',
    'rectangular',
    'diamond'
);


ALTER TYPE public.shapetype OWNER TO postgres;

--
-- Name: slotstyle; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.slotstyle AS ENUM (
    'radial',
    'linear'
);


ALTER TYPE public.slotstyle OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO postgres;

--
-- Name: archetype_constraints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.archetype_constraints (
    archetype_id character varying(50) NOT NULL,
    available_sliders character varying[] NOT NULL,
    size_constraint jsonb,
    width_constraint jsonb,
    height_constraint jsonb,
    slots_constraint jsonb,
    separation_constraint jsonb,
    side_margin_constraint jsonb
);


ALTER TABLE public.archetype_constraints OWNER TO postgres;

--
-- Name: archetypes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.archetypes (
    id character varying(50) NOT NULL,
    shape public.shapetype NOT NULL,
    slot_style public.slotstyle NOT NULL,
    label character varying(100) NOT NULL,
    tooltip text,
    thumbnail character varying(255),
    number_sections integer NOT NULL,
    available_grains character varying[] NOT NULL,
    number_slots integer NOT NULL,
    separation double precision,
    side_margin double precision,
    sort_order integer,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.archetypes OWNER TO postgres;

--
-- Name: background_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.background_config (
    id integer NOT NULL,
    default_room character varying(50),
    default_wall_finish character varying(50),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.background_config OWNER TO postgres;

--
-- Name: background_paints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.background_paints (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    group_name character varying(50) NOT NULL,
    rgb double precision[],
    texture_path character varying(255),
    sort_order integer,
    is_active boolean
);


ALTER TABLE public.background_paints OWNER TO postgres;

--
-- Name: background_rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.background_rooms (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    path character varying(255) NOT NULL,
    foreground_path character varying(255),
    wall_compensation double precision,
    art_placement jsonb NOT NULL,
    lighting jsonb NOT NULL,
    sort_order integer,
    is_active boolean
);


ALTER TABLE public.background_rooms OWNER TO postgres;

--
-- Name: backing_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backing_config (
    id integer NOT NULL,
    default_enabled boolean,
    default_type character varying(20),
    default_material character varying(50),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.backing_config OWNER TO postgres;

--
-- Name: backing_materials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backing_materials (
    id character varying(50) NOT NULL,
    backing_type_id character varying(20) NOT NULL,
    material_id character varying(50) NOT NULL,
    display character varying(100) NOT NULL,
    description text,
    color_rgb double precision[] NOT NULL,
    alpha double precision,
    pbr_properties jsonb NOT NULL,
    texture_files jsonb,
    sort_order integer,
    is_active boolean
);


ALTER TABLE public.backing_materials OWNER TO postgres;

--
-- Name: backing_type_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backing_type_configs (
    type character varying(20) NOT NULL,
    display_name character varying(50) NOT NULL,
    thickness_inches double precision NOT NULL,
    inset_inches double precision NOT NULL,
    description text,
    sort_order integer,
    is_active boolean
);


ALTER TABLE public.backing_type_configs OWNER TO postgres;

--
-- Name: color_palettes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.color_palettes (
    id character varying(50) NOT NULL,
    color_deep double precision[] NOT NULL,
    color_mid double precision[] NOT NULL,
    color_light double precision[] NOT NULL,
    paper_color double precision[] NOT NULL,
    sort_order integer,
    is_active boolean
);


ALTER TABLE public.color_palettes OWNER TO postgres;

--
-- Name: composition_defaults; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.composition_defaults (
    id integer NOT NULL,
    frame_design jsonb NOT NULL,
    pattern_settings jsonb NOT NULL,
    audio_source jsonb NOT NULL,
    audio_processing jsonb NOT NULL,
    peak_control jsonb NOT NULL,
    visual_correction jsonb NOT NULL,
    display_settings jsonb NOT NULL,
    export_settings jsonb NOT NULL,
    artistic_rendering jsonb NOT NULL,
    processed_amplitudes jsonb,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.composition_defaults OWNER TO postgres;

--
-- Name: manufacturing_constraints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manufacturing_constraints (
    id integer NOT NULL,
    version character varying(20),
    description text,
    valid_shapes character varying[] NOT NULL,
    cnc_max_x double precision NOT NULL,
    cnc_max_y double precision NOT NULL,
    circular_constraints jsonb NOT NULL,
    rectangular_constraints jsonb NOT NULL,
    diamond_constraints jsonb NOT NULL,
    slot_style_constraints jsonb NOT NULL,
    scene_constraints jsonb,
    ui_visibility jsonb,
    audio_constraints jsonb,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.manufacturing_constraints OWNER TO postgres;

--
-- Name: placement_defaults; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.placement_defaults (
    id integer NOT NULL,
    scene_overrides jsonb,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.placement_defaults OWNER TO postgres;

--
-- Name: ui_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ui_config (
    id integer NOT NULL,
    elements jsonb DEFAULT '{}'::jsonb NOT NULL,
    buttons jsonb DEFAULT '{}'::jsonb NOT NULL,
    upload jsonb DEFAULT '{}'::jsonb NOT NULL,
    thumbnail_config jsonb DEFAULT '{}'::jsonb,
    categories jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ui_config OWNER TO postgres;

--
-- Name: wood_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wood_config (
    id integer NOT NULL,
    valid_grain_directions character varying[] NOT NULL,
    default_species character varying(50) NOT NULL,
    default_grain_direction character varying(20) NOT NULL,
    texture_config jsonb NOT NULL,
    rendering_config jsonb NOT NULL,
    geometry_constants jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.wood_config OWNER TO postgres;

--
-- Name: wood_species; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wood_species (
    id character varying(50) NOT NULL,
    display character varying(100) NOT NULL,
    wood_number character varying(10) NOT NULL,
    sort_order integer,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.wood_species OWNER TO postgres;

--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alembic_version (version_num) FROM stdin;
002_ui_config
\.


--
-- Data for Name: archetype_constraints; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.archetype_constraints (archetype_id, available_sliders, size_constraint, width_constraint, height_constraint, slots_constraint, separation_constraint, side_margin_constraint) FROM stdin;
circular_radial_n1	{size,slots}	{"max": 30, "min": 24, "step": 1}	null	null	{"max": 60, "min": 36}	null	null
circular_radial_n2	{size,slots,separation}	{"max": 42, "min": 24, "step": 1}	null	null	{"max": 72, "min": 36}	{"max": 4.0, "min": 0.5, "step": 0.5}	null
circular_radial_n3	{size,slots,separation}	{"max": 54, "min": 30, "step": 1}	null	null	{"max": 96, "min": 36}	{"max": 4.0, "min": 0.5, "step": 0.5}	null
circular_radial_n4	{size,slots,separation}	{"max": 60, "min": 30, "step": 1}	null	null	{"max": 96, "min": 36}	{"max": 4.0, "min": 0.5, "step": 0.5}	null
circular_linear_n1	{size,slots,side_margin}	{"max": 30, "min": 24, "step": 1}	null	null	{"max": 30, "min": 12}	null	{"max": 11, "min": 0, "step": 1.0}
circular_linear_n2	{size,slots,separation,side_margin}	{"max": 42, "min": 24, "step": 1}	null	null	{"max": 42, "min": 12}	{"max": 4.0, "min": 0.5, "step": 0.5}	{"max": 11, "min": 0, "step": 1.0}
rectangular_radial_n1	{width,height,slots}	null	{"max": 42, "min": 24, "step": 1}	{"max": 42, "min": 24, "step": 1}	{"max": 60, "min": 36}	null	null
rectangular_radial_n2	{width,height,slots,separation}	null	{"max": 60, "min": 24, "step": 1}	{"max": 42, "min": 24, "step": 1}	{"max": 60, "min": 36}	{"max": 4.0, "min": 0.5, "step": 0.5}	null
rectangular_radial_n4	{width,height,slots,separation}	null	{"max": 84, "min": 30, "step": 1}	{"max": 84, "min": 30, "step": 1}	{"max": 96, "min": 36}	{"max": 4.0, "min": 0.5, "step": 0.5}	null
rectangular_linear_n1	{width,height,slots,side_margin}	null	{"max": 42, "min": 24, "step": 1}	{"max": 42, "min": 12, "step": 1}	{"max": 200, "min": 12}	null	{"max": 11, "min": 0, "step": 1.0}
rectangular_linear_n2	{width,height,slots,separation,side_margin}	null	{"max": 84, "min": 36, "step": 1}	{"max": 84, "min": 12, "step": 1}	{"max": 200, "min": 12}	{"max": 4.0, "min": 0.5, "step": 0.5}	{"max": 11, "min": 0, "step": 1.0}
rectangular_linear_n3	{width,height,slots,separation,side_margin}	null	{"max": 96, "min": 12, "step": 1}	{"max": 42, "min": 12, "step": 1}	{"max": 200, "min": 12}	{"max": 4.0, "min": 0.5, "step": 0.5}	{"max": 11, "min": 0, "step": 1.0}
rectangular_linear_n4	{width,height,slots,separation,side_margin}	null	{"max": 120, "min": 12, "step": 1}	{"max": 42, "min": 12, "step": 1}	{"max": 200, "min": 12}	{"max": 4.0, "min": 0.5, "step": 0.5}	{"max": 11, "min": 0, "step": 1.0}
diamond_radial_n1	{width,height,slots}	null	{"max": 42, "min": 24, "step": 1}	{"max": 42, "min": 24, "step": 1}	{"max": 48, "min": 24}	null	null
diamond_radial_n2	{width,height,slots,separation}	null	{"max": 60, "min": 36, "step": 1}	{"max": 60, "min": 36, "step": 1}	{"max": 96, "min": 24}	{"max": 4.0, "min": 0.5, "step": 0.5}	null
diamond_radial_n4	{width,height,slots,separation}	null	{"max": 84, "min": 36, "step": 1}	{"max": 84, "min": 36, "step": 1}	{"max": 96, "min": 24}	{"max": 4.0, "min": 0.5, "step": 0.5}	null
diamond_linear_n1	{width,height,slots,side_margin}	null	{"max": 42, "min": 30, "step": 1}	{"max": 42, "min": 30, "step": 1}	{"max": 24, "min": 12}	null	{"max": 11, "min": 0, "step": 1.0}
diamond_linear_n2	{width,height,slots,separation,side_margin}	null	{"max": 60, "min": 36, "step": 1}	{"max": 42, "min": 30, "step": 1}	{"max": 48, "min": 24}	{"max": 4.0, "min": 0.5, "step": 0.5}	{"max": 11, "min": 0, "step": 1.0}
\.


--
-- Data for Name: archetypes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.archetypes (id, shape, slot_style, label, tooltip, thumbnail, number_sections, available_grains, number_slots, separation, side_margin, sort_order, is_active, created_at, updated_at) FROM stdin;
circular_radial_n1	circular	radial	Circular Radial - 1 Section	Circular Design - Radial Waveform\nOne Panel\n\nAvailable size:\n24 to 30 inch diameter.	/assets/style/thumbnails/circular_radial_n1.png	1	{vertical,horizontal}	48	0	\N	0	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
circular_radial_n2	circular	radial	Circular Radial - 2 Sections	Circular Design - Radial Waveform\nTwo Panels\n\nAvailable size:\n24 to 42 inch diameter	/assets/style/thumbnails/circular_radial_n2.png	2	{vertical,horizontal}	48	2	\N	1	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
circular_radial_n3	circular	radial	Circular Radial - 3 Sections	Circular Design - Radial Waveform\nThree Panels\n\nAvailable size:\n24 to 54 inch diameter	/assets/style/thumbnails/circular_radial_n3.png	3	{vertical,horizontal,radiant}	48	1.5	\N	2	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
circular_radial_n4	circular	radial	Circular Radial - 4 Sections	Circular Design - Radial Waveform\nFour Panels\n\nAvailable size:\n24 to 60 inch diameter	/assets/style/thumbnails/circular_radial_n4.png	4	{vertical,horizontal,radiant,diamond}	48	1	\N	3	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
circular_linear_n1	circular	linear	Circular Linear - 1 Section	Circular Design - Linear Waveform\nOne Panel\n\nAvailable size:\n24 to 30 inch diameter	/assets/style/thumbnails/circular_linear_n1.png	1	{vertical,horizontal}	24	0	3	4	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
circular_linear_n2	circular	linear	Circular Linear - 2 Sections	Circular Design - Linear Waveform\nTwo Panels\n\nAvailable size:\n24 to 42 inch diameter	/assets/style/thumbnails/circular_linear_n2.png	2	{vertical,horizontal}	24	2	3	5	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
rectangular_radial_n1	rectangular	radial	Rectangular Radial - 1 Section	This is a tooltip	/assets/style/thumbnails/rectangular_radial_n1.png	1	{vertical,horizontal}	48	0	\N	6	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
rectangular_radial_n2	rectangular	radial	Rectangular Radial - 2 Sections	This is a tooltip	/assets/style/thumbnails/rectangular_radial_n2.png	2	{vertical,horizontal}	48	2	\N	7	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
rectangular_radial_n4	rectangular	radial	Rectangular Radial - 4 Sections	This is a tooltip	/assets/style/thumbnails/rectangular_radial_n4.png	4	{vertical,horizontal,radiant,diamond}	48	1	\N	8	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
rectangular_linear_n1	rectangular	linear	Rectangular Linear - 1 Section	This is a tooltip	/assets/style/thumbnails/rectangular_linear_n1.png	1	{vertical,horizontal}	18	0	\N	9	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
rectangular_linear_n2	rectangular	linear	Rectangular Linear - 2 Sections (Side-by-Side)	This is a tooltip	/assets/style/thumbnails/rectangular_linear_n2.png	2	{vertical,horizontal}	36	2	\N	10	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
rectangular_linear_n3	rectangular	linear	Rectangular Linear - 3 Sections (Side-by-Side)	This is a tooltip	/assets/style/thumbnails/rectangular_linear_n3.png	3	{vertical,horizontal}	54	2	\N	11	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
rectangular_linear_n4	rectangular	linear	Rectangular Linear - 4 Sections (Side-by-Side)	This is a tooltip	/assets/style/thumbnails/rectangular_linear_n4.png	4	{vertical,horizontal,radiant,diamond}	72	2	\N	12	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
diamond_radial_n1	diamond	radial	Diamond Radial - 1 Section	This is a tooltip	/assets/style/thumbnails/diamond_radial_n1.png	1	{vertical,horizontal}	48	0	\N	13	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
diamond_radial_n2	diamond	radial	Diamond Radial - 2 Sections	This is a tooltip	/assets/style/thumbnails/diamond_radial_n2.png	2	{vertical,horizontal}	48	1.5	\N	14	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
diamond_radial_n4	diamond	radial	Diamond Radial - 4 Sections	This is a tooltip	/assets/style/thumbnails/diamond_radial_n4.png	4	{vertical,horizontal,radiant,diamond}	48	2	\N	15	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
diamond_linear_n1	diamond	linear	Diamond Linear - 1 Section	This is a tooltip	/assets/style/thumbnails/diamond_linear_n1.png	1	{vertical,horizontal}	24	0	5	16	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
diamond_linear_n2	diamond	linear	Diamond Linear - 2 Sections	This is a tooltip	/assets/style/thumbnails/diamond_linear_n2.png	2	{vertical,horizontal}	24	2	5	17	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
\.


--
-- Data for Name: background_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.background_config (id, default_room, default_wall_finish, updated_at) FROM stdin;
1	blank_wall	warm-beige	2025-12-21 22:49:56.447231
\.


--
-- Data for Name: background_paints; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.background_paints (id, name, description, group_name, rgb, texture_path, sort_order, is_active) FROM stdin;
soft-white	Soft White	Soft, warm white	Whites	{0.929,0.918,0.878}	\N	0	t
bright-white	Bright White	Clean, bright white	Whites	{0.969,0.965,0.953}	\N	1	t
warm-gray	Warm Gray	Warm, versatile greige	Warm Neutrals	{0.816,0.804,0.784}	\N	2	t
warm-beige	Warm Beige	Warm, neutral beige	Warm Neutrals	{0.851,0.82,0.769}	\N	3	t
taupe-gray	Taupe Gray	Warm taupe-gray	Warm Neutrals	{0.737,0.725,0.698}	\N	4	t
cool-gray	Cool Gray	Cool, light gray	Cool Neutrals	{0.796,0.788,0.769}	\N	5	t
classic-gray	Classic Gray	Classic medium gray	Cool Neutrals	{0.741,0.729,0.702}	\N	6	t
stone-gray	Stone Gray	Soft, neutral gray	Cool Neutrals	{0.745,0.741,0.718}	\N	7	t
sage-mist	Sage Mist	Soft green-gray	Greens	{0.835,0.867,0.851}	\N	8	t
deep-black	Deep Black	Deep, rich black	Darks	{0.227,0.231,0.235}	\N	9	t
brick-white	White Brick	Painted exposed brick	Textures	\N	/assets/backgrounds/accent/white_brick.jpg	10	t
brick-red	Red Brick	Rustic exposed brick	Textures	\N	/assets/backgrounds/accent/brick_wall_red.jpg	11	t
wood-planks	Wood Planks	Warm wooden accent	Textures	\N	/assets/backgrounds/accent/wood_planks.jpg	12	t
concrete	Concrete	Modern industrial look	Textures	\N	/assets/backgrounds/accent/concrete.jpg	13	t
stucco	Stucco	Textured plaster finish	Textures	\N	/assets/backgrounds/accent/stucco.png	14	t
\.


--
-- Data for Name: background_rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.background_rooms (id, name, description, path, foreground_path, wall_compensation, art_placement, lighting, sort_order, is_active) FROM stdin;
blank_wall	Blank Wall	Simple wall with no furniture	/assets/backgrounds/rooms/thumbnails/blank_wall_thumb.jpg	/assets/backgrounds/rooms/blank_wall_foreground.png	1	{"anchor": "center", "position": [0, 0, -20], "rotation": [0, 0, 0], "scale_factor": 0.8}	{"direction": [-0.66, -0.25, -0.71], "ambient_boost": 0.5, "shadow_enabled": true, "shadow_darkness": 0.8}	0	t
minimalist_home_bedroom	Bedroom	Serene bedroom setting	/assets/backgrounds/rooms/thumbnails/minimalist_home_bedroom_thumb.jpg	/assets/backgrounds/rooms/bedroom_foreground.png	1.058	{"anchor": "center", "position": [0, 15, -20], "rotation": [0, 0, 0], "scale_factor": 0.675}	{"direction": [-0.66, -0.25, -0.71], "intensity": 0.5, "ambient_boost": 1.6, "shadow_enabled": true, "shadow_darkness": 0.9, "hemispheric_sky_color": [1, 1, 0.95], "shadow_map_resolution": 2048, "shadow_receiver_position": [0, -0.4, 0]}	5	t
hallway	Hallway	Hallway	/assets/backgrounds/rooms/thumbnails/hallway_thumb.jpg	/assets/backgrounds/rooms/hallway_foreground.png	1.058	{"position": [0, -4, -20], "rotation": [0, 0, 0], "scale_factor": 0.675}	{"direction": [-0.66, -0.25, -0.71], "intensity": 0.5, "ambient_boost": 1.6, "shadow_enabled": true, "shadow_darkness": 0.9, "hemispheric_sky_color": [1, 1, 0.95], "shadow_map_resolution": 2048, "shadow_receiver_position": [0, -0.4, 0]}	6	t
minimalist_home_library	Home Library	Home library with customizable wall color	/assets/backgrounds/rooms/thumbnails/minimalist_home_library_thumb.jpg	/assets/backgrounds/rooms/home_library_foreground.png	1.058	{"anchor": "center", "position": [4.5, 10, -20], "rotation": [0, 0, 0], "scale_factor": 0.675}	{"direction": [-0.66, -0.25, -0.71], "ambient_boost": 1.2, "shadow_enabled": true, "shadow_darkness": 0.8}	7	t
minimalist_home_living_room	Living Room	Living room with customizable wall color.	/assets/backgrounds/rooms/thumbnails/minimalist_home_living_room_thumb.jpg	/assets/backgrounds/rooms/living_room_foreground.png	1.058	{"anchor": "center", "position": [1.5, 17, -20], "rotation": [0, 0, 0], "scale_factor": 0.675}	{"direction": [-0.66, -0.25, -0.71], "ambient_boost": 1.2, "shadow_enabled": true, "shadow_darkness": 0.8}	8	t
minimalist_home_family_room	Family Room	Family room with customizable wall color.	/assets/backgrounds/rooms/thumbnails/minimalist_home_family_room_thumb.jpg	/assets/backgrounds/rooms/family_room_foreground.png	1.058	{"anchor": "center", "position": [0, 15, -20], "rotation": [0, 0, 0], "scale_factor": 0.675}	{"direction": [-0.66, -0.25, -0.71], "ambient_boost": 0.6, "shadow_enabled": true, "shadow_darkness": 0.8}	9	t
dining-room	Dining Room	Elegant dining space	/assets/backgrounds/rooms/dining.jpg	\N	1	{"position": [0, 0, -20], "rotation": [0, 0, 0], "scale_factor": 1.0}	{"direction": [-0.66, -0.25, -0.71], "ambient_boost": 0.5, "shadow_enabled": true, "shadow_darkness": 0.8}	4	f
japandi	Japandi	Japandi living space	/assets/backgrounds/rooms/japandi.jpeg	\N	1	{"position": [-3.5, -3, -20], "rotation": [0, 0, 0], "scale_factor": 0.66}	{"direction": [-1.0, -0.5, -1.0], "intensity": 2.0, "shadow_blur": 20, "ambient_boost": 1.5, "shadow_enabled": true, "shadow_darkness": 0.8, "shadow_filter_mode": "pcf", "shadow_frustum_size": 60}	3	f
living-room-fireplace	Fireplace	Contemporary living space with fireplace	/assets/backgrounds/rooms/living_modern_fireplace.png	\N	1	{"position": [1.5, -4, -20], "rotation": [0, 0, 0], "scale_factor": 0.67}	{"direction": [0.6, 0, -1.0], "intensity": 2.0, "shadow_blur": 5, "ambient_boost": 1.5, "shadow_enabled": true, "shadow_darkness": 0.8, "shadow_filter_mode": "pcf", "shadow_frustum_size": 60}	2	f
living-room-modern	Modern Living Room	Contemporary living space	/assets/backgrounds/rooms/living_room_8.jpeg	\N	1	{"position": [-16, -3.32, -20.0], "rotation": [0, 0, 0], "scale_factor": 0.42}	{"direction": [-0.66, -0.25, -0.71], "ambient_boost": 1.5, "shadow_enabled": true, "shadow_darkness": 0.9, "hemispheric_sky_color": [1, 1, 0.95], "shadow_map_resolution": 2048, "shadow_receiver_position": [0, -0.6, 0]}	1	f
\.


--
-- Data for Name: backing_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.backing_config (id, default_enabled, default_type, default_material, updated_at) FROM stdin;
1	f	acrylic	black	2025-12-21 22:49:56.447231
\.


--
-- Data for Name: backing_materials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.backing_materials (id, backing_type_id, material_id, display, description, color_rgb, alpha, pbr_properties, texture_files, sort_order, is_active) FROM stdin;
acrylic_white	acrylic	white	White	White acrylic	{1,1,1}	1	{"metallic": 0.0, "roughness": 0.2, "clearcoat_intensity": 1.0, "clearcoat_roughness": 0.05}	null	0	t
acrylic_black	acrylic	black	Black	Black acrylic	{0,0,0}	1	{"metallic": 0.0, "roughness": 0.2, "clearcoat_intensity": 1.0, "clearcoat_roughness": 0.05}	null	1	t
acrylic_blue	acrylic	blue	Blue	Sapphire blue translucent acrylic	{0,0.15,0.5}	1	{"metallic": 0.0, "roughness": 0.15, "clearcoat_intensity": 1.0, "clearcoat_roughness": 0.05}	null	2	t
acrylic_red	acrylic	red	Red	Ruby red translucent acrylic	{0.25,0,0}	0.85	{"metallic": 0.0, "roughness": 0.15, "clearcoat_intensity": 1.0, "clearcoat_roughness": 0.05}	null	3	t
acrylic_green	acrylic	green	Green	Emerald green translucent acrylic	{0.05,0.55,0.35}	1	{"metallic": 0.0, "roughness": 0.15, "clearcoat_intensity": 1.0, "clearcoat_roughness": 0.05}	null	4	t
acrylic_amber	acrylic	amber	Amber	Warm amber translucent acrylic	{0.82,0.49,0.09}	1	{"metallic": 0.0, "roughness": 0.15, "clearcoat_intensity": 1.0, "clearcoat_roughness": 0.05}	null	5	t
cloth_natural	cloth	natural	Natural	Natural beige linen weave	{0.85,0.8,0.7}	1	{"metallic": 0.0, "roughness": 0.85}	{"normal": "/assets/textures/fabric/fabric-019_normal.png", "diffuse": "/assets/textures/fabric/fabric-019_color.png"}	0	t
cloth_black	cloth	black	Black	Deep black fabric	{0.1,0.1,0.1}	1	{"metallic": 0.0, "roughness": 0.85}	{"normal": "/assets/textures/fabric/fabric-016_normal.png", "diffuse": "/assets/textures/fabric/fabric-016_color.png"}	1	t
cloth_navy	cloth	navy	Navy	Dark navy blue fabric	{0.1,0.15,0.3}	1	{"metallic": 0.0, "roughness": 0.85}	{"normal": "/assets/textures/fabric/fabric-017_normal.png", "diffuse": "/assets/textures/fabric/fabric-017_color.png"}	2	t
cloth_blue	cloth	blue	Blue	Medium blue fabric	{0.1,0.15,0.3}	1	{"metallic": 0.0, "roughness": 0.85}	{"normal": "/assets/textures/fabric/fabric_199_normal.png", "diffuse": "/assets/textures/fabric/fabric_199_color.png"}	3	t
leather_bison	leather	bison	Bison Hide	Rich brown bison leather	{0.45,0.35,0.25}	1	{"metallic": 0.0, "roughness": 0.7}	{"normal": "/assets/textures/leather/leather-003_n.png", "diffuse": "/assets/textures/leather/leather-003-bison-hide_d.jpg", "roughness": "/assets/textures/leather/leather-003_r.png"}	0	t
leather_falu-red	leather	falu-red	Falu Red	Deep red leather with warm tones	{0.6,0.25,0.2}	1	{"metallic": 0.0, "roughness": 0.7}	{"normal": "/assets/textures/leather/leather-003_n.png", "diffuse": "/assets/textures/leather/leather-003-falu-red_d.jpg", "roughness": "/assets/textures/leather/leather-003_r.png"}	1	t
leather_tussock	leather	tussock	Tussock	Natural tan leather with golden hues	{0.7,0.6,0.4}	1	{"metallic": 0.0, "roughness": 0.7}	{"normal": "/assets/textures/leather/leather-003_n.png", "diffuse": "/assets/textures/leather/leather-003-tussock_d.jpg", "roughness": "/assets/textures/leather/leather-003_r.png"}	2	t
leather_microfiber	leather	microfiber	Microfiber	Synthetic microfiber leather texture	{0.5,0.45,0.4}	1	{"metallic": 0.0, "roughness": 0.65}	{"normal": "/assets/textures/leather/leather-003_n_microfiber.png", "diffuse": "/assets/textures/leather/leather-003-tussock_d.jpg", "roughness": "/assets/textures/leather/leather-003_r.png"}	3	t
foam_charcoal	foam	charcoal	Charcoal	Professional charcoal acoustic foam	{0.01,0.01,0.01}	1	{"metallic": 0.0, "roughness": 0.95}	null	0	t
foam_blue	foam	blue	Blue	Studio blue acoustic foam	{0.2,0.3,0.5}	1	{"metallic": 0.0, "roughness": 0.95}	null	1	t
\.


--
-- Data for Name: backing_type_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.backing_type_configs (type, display_name, thickness_inches, inset_inches, description, sort_order, is_active) FROM stdin;
acrylic	Acrylic	0.125	0.5	Glossy colored acrylic backing with professional finish	0	t
cloth	Cloth	0.0625	0.5	Textured fabric backing with natural weave	1	t
leather	Leather	0.0625	0.5	Premium leather backing with natural texture	2	t
foam	Acoustic Foam	2	0	Pyramid acoustic foam backing for sound dampening	3	t
\.


--
-- Data for Name: color_palettes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.color_palettes (id, color_deep, color_mid, color_light, paper_color, sort_order, is_active) FROM stdin;
ocean	{0,0.2,0.4,0.9}	{0,0.4,0.6,0.7}	{0.2,0.6,0.8,0.5}	{0.98,0.97,0.95,1}	0	t
sunset	{0.4,0.1,0,0.9}	{0.7,0.3,0.1,0.7}	{1,0.6,0.2,0.5}	{0.98,0.95,0.93,1}	1	t
forest	{0,0.2,0.1,0.9}	{0.1,0.4,0.2,0.7}	{0.3,0.6,0.4,0.5}	{0.97,0.98,0.95,1}	2	t
monochrome	{0.1,0.1,0.1,0.9}	{0.4,0.4,0.4,0.7}	{0.7,0.7,0.7,0.5}	{0.98,0.98,0.98,1}	3	t
\.


--
-- Data for Name: composition_defaults; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.composition_defaults (id, frame_design, pattern_settings, audio_source, audio_processing, peak_control, visual_correction, display_settings, export_settings, artistic_rendering, processed_amplitudes, updated_at) FROM stdin;
1	{"shape": "circular", "backing": {"type": "acrylic", "inset": 0.5, "enabled": false, "material": "clear"}, "species": "maple", "finish_x": 36.0, "finish_y": 36.0, "finish_z": 0.375, "separation": 2.0, "number_sections": 2, "frame_orientation": "vertical", "section_materials": [{"species": "walnut-black-american", "section_id": 0, "grain_direction": "vertical"}, {"species": "walnut-black-american", "section_id": 1, "grain_direction": "vertical"}, {"species": "walnut-black-american", "section_id": 2, "grain_direction": "vertical"}, {"species": "walnut-black-american", "section_id": 3, "grain_direction": "vertical"}], "material_thickness": 0.375}	{"spacer": 0.5, "x_offset": 0.75, "y_offset": 1.5, "slot_style": "radial", "grain_angle": 90.0, "lead_radius": 0.25, "orientation": "auto", "side_margin": 0, "bit_diameter": 0.25, "lead_overlap": 0.25, "number_slots": 48, "pattern_diameter": 36.0, "dovetail_settings": {"dovetail_inset": 0.0625, "show_dovetails": false, "generate_dovetails": false, "dovetail_edge_default": 0, "dovetail_cut_direction": "climb", "dovetail_edge_overrides": "{}"}, "amplitude_exponent": 1.0, "scale_center_point": 1.0}	{"end_time": 0.0, "use_stems": false, "start_time": 0.0, "source_file": null, "stem_choice": "vocals"}	{"apply_filter": false, "binning_mode": "mean_abs", "filter_amount": 0.05, "binning_method": "mean", "remove_silence": false, "num_raw_samples": 200000, "silence_duration": 0.5, "silence_threshold": -20, "silence_hop_length": 512, "target_sample_rate": 44100, "silence_frame_length": 2048}	{"method": "none", "threshold": 0.8, "manual_slot": 0, "roll_amount": 0, "clip_enabled": false, "manual_value": 1.0, "nudge_enabled": false, "scale_enabled": false, "manual_enabled": false, "clip_percentage": 0.8, "compress_enabled": false, "scale_all_enabled": false, "compression_exponent": 0.75, "scale_all_percentage": 1.0, "threshold_percentage": 0.9}	{"correction_mode": "nudge_adj", "apply_correction": true, "correction_scale": 1.0}	{"show_labels": false, "show_offsets": false, "show_debug_circle": false, "debug_circle_radius": 1.5}	{"cnc_margin": 1.0, "sections_in_sheet": 1}	{"opacity": 1.0, "ink_settings": {"dryness": 0.3, "ink_flow": 0.4, "ink_density": 0.8, "edge_darkening": 0.6}, "oil_settings": {"impasto": 0.4, "brush_size": 0.5, "color_mixing": 0.6, "brush_texture": 0.5}, "color_palette": "ocean", "artistic_style": "watercolor", "color_palettes": {"ocean": {"color_mid": [0.0, 0.4, 0.6, 0.7], "color_deep": [0.0, 0.2, 0.4, 0.9], "color_light": [0.2, 0.6, 0.8, 0.5], "paper_color": [0.98, 0.97, 0.95, 1.0]}, "forest": {"color_mid": [0.1, 0.4, 0.2, 0.7], "color_deep": [0.0, 0.2, 0.1, 0.9], "color_light": [0.3, 0.6, 0.4, 0.5], "paper_color": [0.97, 0.98, 0.95, 1.0]}, "sunset": {"color_mid": [0.7, 0.3, 0.1, 0.7], "color_deep": [0.4, 0.1, 0.0, 0.9], "color_light": [1.0, 0.6, 0.2, 0.5], "paper_color": [0.98, 0.95, 0.93, 1.0]}, "monochrome": {"color_mid": [0.4, 0.4, 0.4, 0.7], "color_deep": [0.1, 0.1, 0.1, 0.9], "color_light": [0.7, 0.7, 0.7, 0.5], "paper_color": [0.98, 0.98, 0.98, 1.0]}}, "noise_settings": {"flow_speed": 0.3, "noise_seed": 0.0, "noise_scale": 20.0, "noise_octaves": 4.0, "flow_direction": 0.0}, "amplitude_effects": "color", "artistic_intensity": 0.8, "amplitude_influence": 1.0, "physical_simulation": {"drying_time": 0.5, "brush_pressure": 0.7, "paint_thickness": 0.5, "medium_viscosity": 0.5}, "watercolor_settings": {"wetness": 0.7, "granulation": 0.4, "bleed_amount": 0.6, "pigment_load": 0.8, "paper_roughness": 0.5}}	[]	2025-12-21 22:49:56.447231
\.


--
-- Data for Name: manufacturing_constraints; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manufacturing_constraints (id, version, description, valid_shapes, cnc_max_x, cnc_max_y, circular_constraints, rectangular_constraints, diamond_constraints, slot_style_constraints, scene_constraints, ui_visibility, audio_constraints, updated_at) FROM stdin;
1	2.0.0	Complete operational constraints including archetype-specific limits	{circular,rectangular,diamond}	30	42	{"general": {"max": 60, "min": 24, "reason": "CNC table size and shipping requirements"}, "by_section_count": {"1": {"max": 30, "min": 24}, "2": {"max": 42, "min": 24}, "3": {"max": 54, "min": 24}, "4": {"max": 60, "min": 24}}}	{"width": {"max": 120, "min": 12}, "height": {"max": 84, "min": 12}, "reason": "CNC table size and shipping requirements"}	{"width": {"max": 84, "min": 12}, "height": {"max": 84, "min": 12}, "reason": "CNC table size and shipping requirements"}	{"linear": {"x_offset": 1.0}, "radial": {"x_offset": 0.75}}	{"office": {"reason": "placeholder_pending_scene_development", "max_height": null}, "bedroom": {"reason": "headboard_and_ceiling_clearance", "max_height": 42}, "living-room": {"reason": "placeholder_pending_scene_development", "max_height": 54}, "living-room-fireplace": {"reason": "placeholder_pending_scene_development", "max_height": 60}}	{"options": {"sections": {"3": {"disabled_when": {"shape": ["rectangular", "diamond"]}}}, "grainDirection": {"diamond": {"show_when": {"number_sections": [4]}}, "radiant": {"show_when": {"number_sections": [3, 4]}}}}, "elements": {"size": {"show_when": {"shape": ["circular"]}}, "width": {"show_when": {"shape": ["rectangular", "diamond"]}}, "height": {"show_when": {"shape": ["rectangular", "diamond"]}}, "separation": {"show_when": {"number_sections": [2, 3, 4]}}, "side_margin": {"show_when": {"slot_style": ["linear"]}}, "patternDiameter": {"show_when": {"shape": ["rectangular", "diamond"]}}}}	{"upload": {"max_file_size_mb": 100, "accepted_extensions": ["mp3", "wav", "flac", "m4a", "aac", "ogg"], "accepted_mime_types": ["audio/mpeg", "audio/wav", "audio/flac", "audio/mp3", "audio/x-wav", "audio/x-m4a"]}}	2025-12-21 22:49:56.447231
\.


--
-- Data for Name: placement_defaults; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.placement_defaults (id, scene_overrides, updated_at) FROM stdin;
1	{"version": "1.0.0", "archetypes": {"diamond_linear_n1": {"backgrounds": {"paint_and_accent": {"composition_overrides": {"frame_design": {"finish_x": 42, "finish_y": 42}}}}}, "diamond_radial_n1": {"backgrounds": {"paint_and_accent": {"composition_overrides": {"frame_design": {"finish_x": 42, "finish_y": 42}}}}}}}	2025-12-21 22:49:56.447231
\.


--
-- Data for Name: ui_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ui_config (id, elements, buttons, upload, thumbnail_config, categories, updated_at) FROM stdin;
1	{"size": {"id": "size", "type": "range", "label": "Size", "state_path": "frame_design.finish_x", "on_change_triggers": [{"action": "apply_size_defaults", "source_path": "size_defaults"}]}, "shape": {"id": "shape", "type": "select", "label": "Shape", "options": [{"label": "Circular", "value": "circular"}, {"label": "Rectangular", "value": "rectangular"}, {"label": "Diamond", "value": "diamond"}], "state_path": "frame_design.shape"}, "slots": {"id": "slots", "type": "range", "label": "Elements", "state_path": "pattern_settings.number_slots", "display_value_id": "slotsValue"}, "width": {"id": "width", "type": "range", "label": "Width", "state_path": "frame_design.finish_x", "display_value_id": "widthValue"}, "height": {"id": "height", "type": "range", "label": "Height", "state_path": "frame_design.finish_y", "display_value_id": "heightValue"}, "sections": {"id": "sections", "type": "select", "label": "Sections", "options": [{"label": "1", "value": 1}, {"label": "2", "value": 2}, {"label": "3", "value": 3}, {"label": "4", "value": 4}], "state_path": "frame_design.number_sections"}, "separation": {"id": "separation", "type": "range", "label": "Gap", "state_path": "frame_design.separation", "display_value_id": "separationValue"}, "side_margin": {"id": "side_margin", "type": "range", "label": "Side Margin", "state_path": "pattern_settings.side_margin", "display_value_id": "sideMarginValue"}, "woodSpecies": {"id": "woodSpecies", "type": "select", "label": "Wood Species", "state_path": "frame_design.section_materials[].species", "options_path": "species_catalog", "default_value_path": "default_species", "options_from_endpoint": "/api/config/wood-materials", "default_value_from_endpoint": "/api/config/wood-materials"}, "grainDirection": {"id": "grainDirection", "type": "select", "label": "Grain Direction", "options": [{"label": "Horizontal", "value": "horizontal"}, {"label": "Vertical", "value": "vertical"}, {"label": "Radiant", "value": "radiant"}, {"label": "Diamond", "value": "diamond"}], "state_path": "frame_design.section_materials[].grain_direction", "default_value_path": "default_grain_direction", "default_value_from_endpoint": "/api/config/wood-materials"}, "patternDiameter": {"id": "patternDiameter", "type": "select", "label": "Pattern Dia.", "options": [{"label": "24\\"", "value": 24}, {"label": "36\\"", "value": 36}, {"label": "48\\"", "value": 48}, {"label": "60\\"", "value": 60}], "state_path": "pattern_settings.pattern_diameter"}}	{"resetCamera": {"id": "resetCameraButton", "label": "↻", "title": "Reset Camera View", "action": "reset_camera"}, "updateDesign": {"id": "updateButton", "label": "Update Design", "action": "submit_composition_update"}}	{"messages": {"drop_hint": "Drop your audio file here", "invalid_type": "Please upload an audio file (MP3, WAV, or FLAC)", "file_too_large": "File size must be less than {max_size}MB"}, "container_id": "uploadContainer", "drop_zone_id": "uploadDropZone", "file_input_id": "fileInput", "hint_delay_ms": 3000}	{"base_path": "/assets/style/thumbnails", "extension": ".png", "filter_base_path": "/assets/style/filters"}	{"wood": {"label": "WOOD", "order": 2, "subcategories": {"panel": {"label": "Style", "order": 1, "filters": {"shape": {"type": "single", "label": "Panel Shape", "default": "circular", "options": [{"id": "circular", "label": "Circle", "tooltip": "Circular Panel", "thumbnail": "shape_circle"}, {"id": "rectangular", "label": "Rectangle", "tooltip": "Rectangular Panel", "thumbnail": "shape_rectangle"}, {"id": "diamond", "label": "Diamond", "tooltip": "Diamond Panel", "thumbnail": "shape_diamond"}], "ui_state_path": "frame_design.shape"}, "slot_pattern": {"type": "single", "label": "Waveform Pattern", "default": "radial", "options": [{"id": "radial", "label": "Radial", "tooltip": "Radial Waveform", "thumbnail": "pattern_radial"}, {"id": "linear", "label": "Linear", "tooltip": "Linear Waveform", "thumbnail": "pattern_linear"}], "ui_state_path": "pattern_settings.slot_style"}}, "options": {"number_sections": {"type": "archetype_grid", "label": "Number of Sections", "sort_by": "number_sections", "display_field": "label", "archetype_source": "archetypes"}}, "panel_help": "Choose the overall design for your wood panel. Each style combines a panel shape with a waveform pattern.\\n\\nFILTERING: Use the filter icons to narrow by shape (circle, rectangle, diamond) or pattern (radial, linear).\\n\\nSELECTING: Click any card to preview it. Hover to see the name and description.", "panel_title": "ART STYLE"}, "frames": {"note": "", "label": "Frames & Shelves", "order": 5, "filters": {}, "options": {}, "panel_help": "Add a decorative frame or mounting shelf around your panel.\\n\\nComing soon.", "panel_title": "FRAMES"}, "layout": {"label": "Layout", "order": 3, "filters": {}, "options": {"main": {"type": "slider_group", "element_keys": ["size", "width", "height", "slots", "separation", "side_margin"]}}, "panel_help": "Adjust the physical dimensions and detail level of your artwork.\\n\\nCONTROLS:\\n• Size – overall scale of your piece\\n• Elements – number of waveform bars (more = finer detail)\\n• Separation – spacing between sections\\n\\nDrag any slider to adjust. Changes preview in real-time.\\n\\nNOTE: Some options may be limited by your chosen style.", "panel_title": "LAYOUT"}, "backing": {"note": "", "label": "Backing", "order": 4, "filters": {}, "options": {"backing_panel": {"type": "backing_selector"}}, "panel_help": "Add an optional backing material behind your panel for depth and contrast.\\n\\nCHOOSE MATERIAL: When enabled, scroll through color options. Materials include acrylic and painted finishes. Click any swatch to preview.", "panel_title": "BACKING"}, "wood_species": {"label": "Wood & Grain", "order": 2, "filters": {}, "options": {"main": {"type": "wood_species_image_grid"}}, "panel_help": "Select wood species and grain direction for your panel.\\n\\nCHOOSING WOOD: Click a species card to select it. Thumbnails below show grain direction options.\\n\\nMULTI-PANEL DESIGNS: Use the section buttons above to apply different woods to each section. Click \\"All\\" to apply the same wood everywhere.", "panel_title": "WOOD & GRAIN", "enables_section_selection": true}}}, "audio": {"label": "AUDIO", "order": 1, "subcategories": {"tour": {"note": "", "label": "Take the Tour", "order": 1, "filters": {}, "options": {"start_tour": {"type": "tour_launcher"}}, "panel_help": "Watch a 60-second guided tour showing how WaveDesigner transforms audio into custom wood art.\\n\\n• Click the \\"Enjoy the Tour\\" button to begin\\n• The tour auto-advances through key features\\n• Click \\"Skip Tour\\" in the corner to exit anytime", "panel_title": "take the tour"}, "custom": {"label": "Upload Your Song", "order": 3, "filters": {}, "options": {"file_upload": {"type": "audio_upload"}}, "panel_help": "Browse our curated collection of hymns, scripture, prayers, and original works.\\n\\nFILTERING: Use the category buttons (Hymns, Scripture, Prayers, Original, Artists) to filter what's shown.\\n\\nBROWSING: Scroll left/right through cards using the < > arrows or drag. Click any card to select it.\\n\\nVARIANTS: Some tracks have multiple artist recordings. When available, artist chips appear below the cards—click to switch versions.", "panel_title": "upload your worship"}, "slicing": {"label": "Optional Audio Tuning", "order": 4, "filters": {}, "options": {"audio_slicer": {"type": "audio_trimmer"}}, "panel_help": "Focus on a specific part of your audio—like a chorus—to change how your waveform art looks.\\n\\nWAVEFORM: The shaded area shows your selection. Drag the green handle (start) or red handle (end) to adjust.\\n\\nPLAYBACK:\\n• [◀◀ 5s] Skip back 5 seconds\\n• [5s ▶▶] Skip forward 5 seconds\\n• [▶] Play or pause\\n\\nMARKING:\\n• \\"Start Here\\" – marks where selection begins\\n• \\"End Here\\" – marks where selection ends\\n• \\"Reset\\" – clears selection, uses full track\\n\\nVOCAL ISOLATION: Toggle the switch to remove background music and keep only vocals. Processing takes a few moments.", "panel_title": "PICK A MOMENT"}, "collections": {"note": "", "label": "View Our Collections", "order": 2, "filters": {"collection_type": {"type": "single", "label": "Browse By", "default": "hymn", "options": [{"id": "hymn", "label": "Hymns", "tooltip": "Traditional Hymns", "thumbnail": ""}, {"id": "bible", "label": "Scripture", "tooltip": "Bible Passages", "thumbnail": ""}, {"id": "prayer", "label": "Prayers", "tooltip": "Prayers & Litanies", "thumbnail": ""}, {"id": "original", "label": "Original", "tooltip": "Original Works", "thumbnail": ""}, {"id": "artist", "label": "Artists", "tooltip": "Browse by Artist", "thumbnail": ""}], "ui_state_path": "ui.collectionFilter"}}, "options": {"collections_browser": {"type": "collections_browser"}}, "panel_help": "Browse our curated collection of hymns, scripture, prayers, and original works.\\n\\nFILTERING: Use the category buttons (Hymns, Scripture, Prayers, Original, Artists) to filter what's shown.\\n\\nBROWSING: Scroll left/right through cards using the < > arrows or drag. Click any card to select it.\\n\\nVARIANTS: Some tracks have multiple artist recordings. When available, artist chips appear below the cards—click to switch versions.", "panel_title": "COLLECTIONS"}}}, "print": {"label": "PRINTS", "order": 3, "subcategories": {"metal": {"note": "", "label": "Metal", "order": 3, "filters": {}, "options": {}, "panel_help": "Print your waveform design on brushed aluminum for a modern, vibrant look.\\n\\nComing soon.", "panel_title": "METAL"}, "canvas": {"note": "", "label": "Canvas", "order": 1, "filters": {}, "options": {}, "panel_help": "Print your waveform design on gallery-wrapped canvas.\\n\\nComing soon.", "panel_title": "CANVAS"}, "fine_art_paper": {"note": "", "label": "Fine Art Paper", "order": 2, "filters": {}, "options": {}, "panel_help": "Print your waveform design on archival fine art paper, ready for custom framing.\\n\\nComing soon.", "panel_title": "FINE ART PAPER"}}}, "backgrounds": {"label": "STAGING", "order": 4, "subcategories": {"paint": {"label": "Wall Finish", "order": 2, "filters": {}, "options": {"paint_grid": {"type": "thumbnail_grid"}}, "panel_help": "Choose a wall color to see how your panel contrasts against different backgrounds.\\n\\nCOLORS: Organized by tone (warm, cool, neutral). Scroll horizontally to browse.\\n\\nSELECTING: Click any swatch to apply. The preview updates immediately.", "panel_title": "PAINT COLORS"}, "rooms": {"label": "Room Settings", "order": 1, "filters": {}, "options": {"rooms_grid": {"type": "thumbnail_grid"}}, "panel_help": "Preview your panel in realistic room environments.\\n\\nSELECTING: Click any room thumbnail to place your artwork in that scene. Each environment includes appropriate lighting and wall positioning.", "panel_title": "ROOM SETTINGS"}}}}	2025-12-21 22:49:56.447231
\.


--
-- Data for Name: wood_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wood_config (id, valid_grain_directions, default_species, default_grain_direction, texture_config, rendering_config, geometry_constants, updated_at) FROM stdin;
1	{horizontal,vertical,radiant,diamond}	walnut-black-american	vertical	{"size_map": {"large": {"folder": "Large_400cm", "dimensions": "300x400cm"}, "small": {"folder": "Small_36cm", "dimensions": "300x036cm"}, "medium": {"folder": "Medium_99cm", "dimensions": "300x099cm"}}, "base_texture_path": "/assets/textures/wood", "size_thresholds_inches": {"small": 18.0, "medium": 30.0}}	{"grain_direction_angles": {"diamond": "use_section_positioning_4_diamond", "radiant": "use_section_positioning", "vertical": 90, "horizontal": 0}, "grain_rotation_offset_degrees": 0.0}	{"section_rotation_offsets": {"2": [0, 180], "3": [60, 300, 180], "4": [0, 270, 180, 90]}, "section_positioning_angles": {"1": [0], "2": [0, 180], "3": [90, 330, 210], "4_diamond": [45, 315, 225, 135], "4_radiant": [135, 45, 315, 225]}}	2025-12-21 22:49:56.447231
\.


--
-- Data for Name: wood_species; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wood_species (id, display, wood_number, sort_order, is_active, created_at, updated_at) FROM stdin;
walnut-black-american	Walnut	109	0	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
cherry-black	Cherry	085	1	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
maple	Maple	098	2	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
maple-birdseye	Maple (Birdseye)	097	3	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
oak-white-american	Oak (White)	100	4	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
oak-red-american	Oak (Red)	099	5	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
mahogany-american	Mahogany	095	6	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
alder-red	Alder	079	7	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
bloodwood	Bloodwood	082	8	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
bubinga	Bubinga	054	9	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
cedar-western-red	Cedar	083	10	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
padauk-african	Padauk	069	11	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
pine-north-carolina	Pine	102	12	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
wenge	Wenge	077	13	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
zebrano	Zebrawood	078	14	t	2025-12-21 22:49:56.447231	2025-12-21 22:49:56.447231
\.


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: archetype_constraints archetype_constraints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archetype_constraints
    ADD CONSTRAINT archetype_constraints_pkey PRIMARY KEY (archetype_id);


--
-- Name: archetypes archetypes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archetypes
    ADD CONSTRAINT archetypes_pkey PRIMARY KEY (id);


--
-- Name: background_config background_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_config
    ADD CONSTRAINT background_config_pkey PRIMARY KEY (id);


--
-- Name: background_paints background_paints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_paints
    ADD CONSTRAINT background_paints_pkey PRIMARY KEY (id);


--
-- Name: background_rooms background_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_rooms
    ADD CONSTRAINT background_rooms_pkey PRIMARY KEY (id);


--
-- Name: backing_config backing_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backing_config
    ADD CONSTRAINT backing_config_pkey PRIMARY KEY (id);


--
-- Name: backing_materials backing_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backing_materials
    ADD CONSTRAINT backing_materials_pkey PRIMARY KEY (id);


--
-- Name: backing_type_configs backing_type_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backing_type_configs
    ADD CONSTRAINT backing_type_configs_pkey PRIMARY KEY (type);


--
-- Name: color_palettes color_palettes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.color_palettes
    ADD CONSTRAINT color_palettes_pkey PRIMARY KEY (id);


--
-- Name: composition_defaults composition_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.composition_defaults
    ADD CONSTRAINT composition_defaults_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_constraints manufacturing_constraints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturing_constraints
    ADD CONSTRAINT manufacturing_constraints_pkey PRIMARY KEY (id);


--
-- Name: placement_defaults placement_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.placement_defaults
    ADD CONSTRAINT placement_defaults_pkey PRIMARY KEY (id);


--
-- Name: ui_config ui_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ui_config
    ADD CONSTRAINT ui_config_pkey PRIMARY KEY (id);


--
-- Name: wood_config wood_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wood_config
    ADD CONSTRAINT wood_config_pkey PRIMARY KEY (id);


--
-- Name: wood_species wood_species_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wood_species
    ADD CONSTRAINT wood_species_pkey PRIMARY KEY (id);


--
-- Name: ix_archetypes_shape_style; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_archetypes_shape_style ON public.archetypes USING btree (shape, slot_style);


--
-- Name: ix_backing_materials_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_backing_materials_type ON public.backing_materials USING btree (backing_type_id);


--
-- Name: ix_wood_species_sort_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_wood_species_sort_order ON public.wood_species USING btree (sort_order);


--
-- Name: archetype_constraints archetype_constraints_archetype_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archetype_constraints
    ADD CONSTRAINT archetype_constraints_archetype_id_fkey FOREIGN KEY (archetype_id) REFERENCES public.archetypes(id);


--
-- Name: background_config background_config_default_room_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_config
    ADD CONSTRAINT background_config_default_room_fkey FOREIGN KEY (default_room) REFERENCES public.background_rooms(id);


--
-- Name: background_config background_config_default_wall_finish_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_config
    ADD CONSTRAINT background_config_default_wall_finish_fkey FOREIGN KEY (default_wall_finish) REFERENCES public.background_paints(id);


--
-- Name: backing_config backing_config_default_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backing_config
    ADD CONSTRAINT backing_config_default_type_fkey FOREIGN KEY (default_type) REFERENCES public.backing_type_configs(type);


--
-- Name: backing_materials backing_materials_backing_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backing_materials
    ADD CONSTRAINT backing_materials_backing_type_id_fkey FOREIGN KEY (backing_type_id) REFERENCES public.backing_type_configs(type);


--
-- Name: wood_config wood_config_default_species_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wood_config
    ADD CONSTRAINT wood_config_default_species_fkey FOREIGN KEY (default_species) REFERENCES public.wood_species(id);


--
-- PostgreSQL database dump complete
--

\unrestrict WdS6NjKgbRD7dkXRn8OUf1ZjoXac44cjfLFH9zYSZLYmMiusvBNzVfZqrUjXgdS

