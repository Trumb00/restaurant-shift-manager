-- ============================================================
-- 002_seed_roles_and_slots.sql
-- Restaurant Shift Manager - Default Seed Data
-- ============================================================

-- ============================================================
-- OPERATIONAL ROLES
-- ============================================================

INSERT INTO roles (id, name, description, color, is_active) VALUES
  (uuid_generate_v4(), 'Cameriere',    'Servizio ai tavoli e gestione clienti',     '#3b82f6', true),
  (uuid_generate_v4(), 'Chef',         'Preparazione pasti e gestione cucina',       '#ef4444', true),
  (uuid_generate_v4(), 'Barista',      'Preparazione bevande e gestione bar',        '#f59e0b', true),
  (uuid_generate_v4(), 'Lavapiatti',   'Pulizia stoviglie e supporto cucina',        '#6b7280', true),
  (uuid_generate_v4(), 'Responsabile', 'Supervisione generale e gestione turni',     '#8b5cf6', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- TIME SLOTS
-- ============================================================

INSERT INTO time_slots (id, name, start_time, end_time, slot_type, day_of_week, is_active) VALUES
  (uuid_generate_v4(), 'Preparazione', '09:00:00', '11:00:00', 'prep',    '{0,1,2,3,4,5,6}', true),
  (uuid_generate_v4(), 'Pranzo',       '11:00:00', '15:30:00', 'service', '{0,1,2,3,4,5,6}', true),
  (uuid_generate_v4(), 'Intervallo',   '15:30:00', '18:00:00', 'prep',    '{0,1,2,3,4,5,6}', true),
  (uuid_generate_v4(), 'Cena',         '18:00:00', '23:30:00', 'service', '{0,1,2,3,4,5,6}', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SERVICE REQUIREMENTS
-- We need to reference IDs by name since UUIDs were generated above.
-- ============================================================

-- Pranzo: Cameriere (ideal 3, min 2)
INSERT INTO service_requirements (time_slot_id, role_id, min_count, ideal_count)
SELECT
  ts.id AS time_slot_id,
  r.id  AS role_id,
  2     AS min_count,
  3     AS ideal_count
FROM time_slots ts
CROSS JOIN roles r
WHERE ts.name = 'Pranzo'
  AND r.name  = 'Cameriere'
ON CONFLICT (time_slot_id, role_id) DO NOTHING;

-- Pranzo: Chef (ideal 1, min 1)
INSERT INTO service_requirements (time_slot_id, role_id, min_count, ideal_count)
SELECT
  ts.id AS time_slot_id,
  r.id  AS role_id,
  1     AS min_count,
  1     AS ideal_count
FROM time_slots ts
CROSS JOIN roles r
WHERE ts.name = 'Pranzo'
  AND r.name  = 'Chef'
ON CONFLICT (time_slot_id, role_id) DO NOTHING;

-- Pranzo: Barista (ideal 1, min 1)
INSERT INTO service_requirements (time_slot_id, role_id, min_count, ideal_count)
SELECT
  ts.id AS time_slot_id,
  r.id  AS role_id,
  1     AS min_count,
  1     AS ideal_count
FROM time_slots ts
CROSS JOIN roles r
WHERE ts.name = 'Pranzo'
  AND r.name  = 'Barista'
ON CONFLICT (time_slot_id, role_id) DO NOTHING;

-- Cena: Cameriere (ideal 3, min 2)
INSERT INTO service_requirements (time_slot_id, role_id, min_count, ideal_count)
SELECT
  ts.id AS time_slot_id,
  r.id  AS role_id,
  2     AS min_count,
  3     AS ideal_count
FROM time_slots ts
CROSS JOIN roles r
WHERE ts.name = 'Cena'
  AND r.name  = 'Cameriere'
ON CONFLICT (time_slot_id, role_id) DO NOTHING;

-- Cena: Chef (ideal 1, min 1)
INSERT INTO service_requirements (time_slot_id, role_id, min_count, ideal_count)
SELECT
  ts.id AS time_slot_id,
  r.id  AS role_id,
  1     AS min_count,
  1     AS ideal_count
FROM time_slots ts
CROSS JOIN roles r
WHERE ts.name = 'Cena'
  AND r.name  = 'Chef'
ON CONFLICT (time_slot_id, role_id) DO NOTHING;

-- Cena: Barista (ideal 1, min 1)
INSERT INTO service_requirements (time_slot_id, role_id, min_count, ideal_count)
SELECT
  ts.id AS time_slot_id,
  r.id  AS role_id,
  1     AS min_count,
  1     AS ideal_count
FROM time_slots ts
CROSS JOIN roles r
WHERE ts.name = 'Cena'
  AND r.name  = 'Barista'
ON CONFLICT (time_slot_id, role_id) DO NOTHING;

-- ============================================================
-- DEFAULT NOTIFICATION TEMPLATES
-- ============================================================

INSERT INTO notification_templates (type, subject, body_template, channel, is_active) VALUES
  (
    'schedule_published',
    'Il tuo turno è stato pubblicato',
    'Ciao {{first_name}}, il turno della settimana {{week_start}} è stato pubblicato. Accedi all''app per visualizzare i tuoi turni.',
    'email',
    true
  ),
  (
    'shift_assigned',
    'Nuovo turno assegnato',
    'Ciao {{first_name}}, ti è stato assegnato un turno il {{date}} dalle {{start_time}} alle {{end_time}} come {{role}}.',
    'email',
    true
  ),
  (
    'shift_cancelled',
    'Turno cancellato',
    'Ciao {{first_name}}, il tuo turno del {{date}} dalle {{start_time}} alle {{end_time}} è stato cancellato.',
    'email',
    true
  ),
  (
    'vacation_approved',
    'Richiesta ferie approvata',
    'Ciao {{first_name}}, la tua richiesta di {{type}} dal {{start_date}} al {{end_date}} è stata approvata.',
    'email',
    true
  ),
  (
    'vacation_rejected',
    'Richiesta ferie rifiutata',
    'Ciao {{first_name}}, la tua richiesta di {{type}} dal {{start_date}} al {{end_date}} è stata rifiutata. Motivazione: {{reviewer_notes}}.',
    'email',
    true
  ),
  (
    'swap_requested',
    'Richiesta di scambio turno',
    'Ciao {{first_name}}, {{requester_name}} ha richiesto di scambiare il turno del {{date}}. Accedi all''app per accettare o rifiutare.',
    'in_app',
    true
  ),
  (
    'swap_approved',
    'Scambio turno approvato',
    'Ciao {{first_name}}, lo scambio di turno richiesto il {{date}} è stato approvato.',
    'email',
    true
  ),
  (
    'on_call_activated',
    'Sei stato chiamato per coprire un turno',
    'Ciao {{first_name}}, sei stato contattato per coprire il turno del {{date}} dalle {{start_time}} alle {{end_time}}. Contatta il responsabile.',
    'email',
    true
  )
ON CONFLICT (type) DO NOTHING;
