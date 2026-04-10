-- ============================================================
-- 001_schema.sql
-- Restaurant Shift Manager - Complete PostgreSQL Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE contract_type_enum AS ENUM ('full_time', 'part_time', 'on_call');
CREATE TYPE app_role_enum AS ENUM ('admin', 'manager', 'employee');
CREATE TYPE slot_type_enum AS ENUM ('prep', 'service', 'cleanup');
CREATE TYPE schedule_status_enum AS ENUM ('draft', 'published', 'archived');
CREATE TYPE shift_status_enum AS ENUM ('draft', 'published', 'confirmed', 'completed', 'cancelled');
CREATE TYPE vacation_type_enum AS ENUM ('ferie', 'permesso', 'malattia', 'altro');
CREATE TYPE vacation_status_enum AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE availability_preference_enum AS ENUM ('available', 'preferred', 'unavailable');
CREATE TYPE swap_status_enum AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE notification_channel_enum AS ENUM ('email', 'push', 'in_app');
CREATE TYPE notification_status_enum AS ENUM ('pending', 'sent', 'read');

-- ============================================================
-- HELPER: updated_at trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE: employees
-- ============================================================

CREATE TABLE employees (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  email                 TEXT UNIQUE NOT NULL,
  phone                 TEXT,
  contract_type         contract_type_enum,
  weekly_hours_contract NUMERIC(5, 2) DEFAULT 40,
  hire_date             DATE,
  is_active             BOOLEAN DEFAULT true,
  app_role              app_role_enum DEFAULT 'employee',
  avatar_url            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employees_user_id    ON employees(user_id);
CREATE INDEX idx_employees_email      ON employees(email);
CREATE INDEX idx_employees_app_role   ON employees(app_role);
CREATE INDEX idx_employees_is_active  ON employees(is_active);

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: roles
-- ============================================================

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#6366f1',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roles_is_active ON roles(is_active);

-- ============================================================
-- TABLE: employee_roles
-- ============================================================

CREATE TABLE employee_roles (
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_id           UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  is_primary        BOOLEAN DEFAULT false,
  proficiency_level INT CHECK (proficiency_level BETWEEN 1 AND 3),
  PRIMARY KEY (employee_id, role_id)
);

CREATE INDEX idx_employee_roles_employee_id ON employee_roles(employee_id);
CREATE INDEX idx_employee_roles_role_id     ON employee_roles(role_id);

-- ============================================================
-- TABLE: time_slots
-- ============================================================

CREATE TABLE time_slots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  slot_type   slot_type_enum DEFAULT 'service',
  day_of_week INT[] DEFAULT '{0,1,2,3,4,5,6}',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_slots_is_active  ON time_slots(is_active);
CREATE INDEX idx_time_slots_slot_type  ON time_slots(slot_type);

-- ============================================================
-- TABLE: service_requirements
-- ============================================================

CREATE TABLE service_requirements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  role_id      UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  min_count    INT NOT NULL DEFAULT 1,
  ideal_count  INT NOT NULL DEFAULT 2,
  UNIQUE (time_slot_id, role_id)
);

CREATE INDEX idx_service_requirements_time_slot_id ON service_requirements(time_slot_id);
CREATE INDEX idx_service_requirements_role_id       ON service_requirements(role_id);

-- ============================================================
-- TABLE: schedules
-- ============================================================

CREATE TABLE schedules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start   DATE NOT NULL,
  week_end     DATE NOT NULL,
  status       schedule_status_enum DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (week_start)
);

CREATE INDEX idx_schedules_week_start ON schedules(week_start);
CREATE INDEX idx_schedules_status     ON schedules(status);

CREATE TRIGGER trg_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: shifts
-- ============================================================

CREATE TABLE shifts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id    UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  employee_id    UUID REFERENCES employees(id) ON DELETE SET NULL,
  time_slot_id   UUID REFERENCES time_slots(id) ON DELETE SET NULL,
  role_id        UUID REFERENCES roles(id) ON DELETE SET NULL,
  date           DATE NOT NULL,
  actual_start   TIMESTAMPTZ,
  actual_end     TIMESTAMPTZ,
  status         shift_status_enum DEFAULT 'draft',
  is_split_shift BOOLEAN DEFAULT false,
  split_group_id UUID,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shifts_schedule_id  ON shifts(schedule_id);
CREATE INDEX idx_shifts_employee_id  ON shifts(employee_id);
CREATE INDEX idx_shifts_time_slot_id ON shifts(time_slot_id);
CREATE INDEX idx_shifts_role_id      ON shifts(role_id);
CREATE INDEX idx_shifts_date         ON shifts(date);
CREATE INDEX idx_shifts_status       ON shifts(status);

CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: vacations
-- ============================================================

CREATE TABLE vacations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  type            vacation_type_enum DEFAULT 'ferie',
  status          vacation_status_enum DEFAULT 'pending',
  reason          TEXT,
  requested_at    TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by     UUID REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  reviewer_notes  TEXT
);

CREATE INDEX idx_vacations_employee_id ON vacations(employee_id);
CREATE INDEX idx_vacations_status      ON vacations(status);
CREATE INDEX idx_vacations_start_date  ON vacations(start_date);
CREATE INDEX idx_vacations_end_date    ON vacations(end_date);

-- ============================================================
-- TABLE: availabilities
-- ============================================================

CREATE TABLE availabilities (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week  INT CHECK (day_of_week BETWEEN 0 AND 6),
  time_slot_id UUID REFERENCES time_slots(id) ON DELETE CASCADE,
  preference   availability_preference_enum DEFAULT 'available',
  UNIQUE (employee_id, day_of_week, time_slot_id)
);

CREATE INDEX idx_availabilities_employee_id  ON availabilities(employee_id);
CREATE INDEX idx_availabilities_day_of_week  ON availabilities(day_of_week);
CREATE INDEX idx_availabilities_time_slot_id ON availabilities(time_slot_id);

-- ============================================================
-- TABLE: incompatibilities
-- ============================================================

CREATE TABLE incompatibilities (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_a_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_b_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reason         TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CHECK (employee_a_id < employee_b_id),
  UNIQUE (employee_a_id, employee_b_id)
);

CREATE INDEX idx_incompatibilities_employee_a_id ON incompatibilities(employee_a_id);
CREATE INDEX idx_incompatibilities_employee_b_id ON incompatibilities(employee_b_id);

-- ============================================================
-- TABLE: on_call_assignments
-- ============================================================

CREATE TABLE on_call_assignments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  time_slot_id UUID REFERENCES time_slots(id) ON DELETE CASCADE,
  priority     INT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (date, time_slot_id, priority)
);

CREATE INDEX idx_on_call_assignments_employee_id  ON on_call_assignments(employee_id);
CREATE INDEX idx_on_call_assignments_date         ON on_call_assignments(date);
CREATE INDEX idx_on_call_assignments_time_slot_id ON on_call_assignments(time_slot_id);

-- ============================================================
-- TABLE: shift_swaps
-- ============================================================

CREATE TABLE shift_swaps (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_shift_id  UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  proposed_shift_id   UUID REFERENCES shifts(id) ON DELETE SET NULL,
  status              swap_status_enum DEFAULT 'pending',
  requested_at        TIMESTAMPTZ DEFAULT NOW(),
  approved_by         UUID REFERENCES employees(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  notes               TEXT
);

CREATE INDEX idx_shift_swaps_requester_shift_id ON shift_swaps(requester_shift_id);
CREATE INDEX idx_shift_swaps_proposed_shift_id  ON shift_swaps(proposed_shift_id);
CREATE INDEX idx_shift_swaps_status             ON shift_swaps(status);

-- ============================================================
-- TABLE: notifications
-- ============================================================

CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  channel      notification_channel_enum DEFAULT 'email',
  status       notification_status_enum DEFAULT 'pending',
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_status       ON notifications(status);
CREATE INDEX idx_notifications_type         ON notifications(type);
CREATE INDEX idx_notifications_channel      ON notifications(channel);

-- ============================================================
-- TABLE: notification_templates
-- ============================================================

CREATE TABLE notification_templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          TEXT NOT NULL UNIQUE,
  subject       TEXT NOT NULL,
  body_template TEXT NOT NULL,
  channel       notification_channel_enum DEFAULT 'email',
  is_active     BOOLEAN DEFAULT true
);

CREATE INDEX idx_notification_templates_type      ON notification_templates(type);
CREATE INDEX idx_notification_templates_is_active ON notification_templates(is_active);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  ip_address  TEXT
);

CREATE INDEX idx_audit_logs_user_id     ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id   ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_timestamp   ON audit_logs(timestamp);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns true if the current auth user has app_role = 'admin'
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM employees
    WHERE user_id = auth.uid()
      AND app_role = 'admin'
      AND is_active = true
  );
$$;

-- Returns true if the current auth user is admin or manager
CREATE OR REPLACE FUNCTION is_manager_or_above()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM employees
    WHERE user_id = auth.uid()
      AND app_role IN ('admin', 'manager')
      AND is_active = true
  );
$$;

-- Returns the employee id for the current auth user
CREATE OR REPLACE FUNCTION current_employee_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id
  FROM employees
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select_manager_above"
  ON employees FOR SELECT
  USING (is_manager_or_above() OR id = current_employee_id());

CREATE POLICY "employees_insert_admin"
  ON employees FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "employees_update_manager_above_or_self"
  ON employees FOR UPDATE
  USING (is_manager_or_above() OR id = current_employee_id())
  WITH CHECK (is_manager_or_above() OR id = current_employee_id());

CREATE POLICY "employees_delete_admin"
  ON employees FOR DELETE
  USING (is_admin());

-- roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select_all_authenticated"
  ON roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "roles_insert_manager_above"
  ON roles FOR INSERT
  WITH CHECK (is_manager_or_above());

CREATE POLICY "roles_update_manager_above"
  ON roles FOR UPDATE
  USING (is_manager_or_above())
  WITH CHECK (is_manager_or_above());

CREATE POLICY "roles_delete_admin"
  ON roles FOR DELETE
  USING (is_admin());

-- employee_roles
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_roles_select_manager_above_or_self"
  ON employee_roles FOR SELECT
  USING (is_manager_or_above() OR employee_id = current_employee_id());

CREATE POLICY "employee_roles_insert_manager_above"
  ON employee_roles FOR INSERT
  WITH CHECK (is_manager_or_above());

CREATE POLICY "employee_roles_update_manager_above"
  ON employee_roles FOR UPDATE
  USING (is_manager_or_above())
  WITH CHECK (is_manager_or_above());

CREATE POLICY "employee_roles_delete_manager_above"
  ON employee_roles FOR DELETE
  USING (is_manager_or_above());

-- time_slots
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_slots_select_all_authenticated"
  ON time_slots FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "time_slots_insert_manager_above"
  ON time_slots FOR INSERT
  WITH CHECK (is_manager_or_above());

CREATE POLICY "time_slots_update_manager_above"
  ON time_slots FOR UPDATE
  USING (is_manager_or_above())
  WITH CHECK (is_manager_or_above());

CREATE POLICY "time_slots_delete_admin"
  ON time_slots FOR DELETE
  USING (is_admin());

-- service_requirements
ALTER TABLE service_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_requirements_select_all_authenticated"
  ON service_requirements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "service_requirements_insert_manager_above"
  ON service_requirements FOR INSERT
  WITH CHECK (is_manager_or_above());

CREATE POLICY "service_requirements_update_manager_above"
  ON service_requirements FOR UPDATE
  USING (is_manager_or_above())
  WITH CHECK (is_manager_or_above());

CREATE POLICY "service_requirements_delete_manager_above"
  ON service_requirements FOR DELETE
  USING (is_manager_or_above());

-- schedules
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules_select_all_authenticated"
  ON schedules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "schedules_insert_manager_above"
  ON schedules FOR INSERT
  WITH CHECK (is_manager_or_above());

CREATE POLICY "schedules_update_manager_above"
  ON schedules FOR UPDATE
  USING (is_manager_or_above())
  WITH CHECK (is_manager_or_above());

CREATE POLICY "schedules_delete_admin"
  ON schedules FOR DELETE
  USING (is_admin());

-- shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shifts_select_manager_above_or_own"
  ON shifts FOR SELECT
  USING (is_manager_or_above() OR employee_id = current_employee_id());

CREATE POLICY "shifts_insert_manager_above"
  ON shifts FOR INSERT
  WITH CHECK (is_manager_or_above());

CREATE POLICY "shifts_update_manager_above"
  ON shifts FOR UPDATE
  USING (is_manager_or_above())
  WITH CHECK (is_manager_or_above());

CREATE POLICY "shifts_delete_manager_above"
  ON shifts FOR DELETE
  USING (is_manager_or_above());

-- vacations
ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vacations_select_manager_above_or_own"
  ON vacations FOR SELECT
  USING (is_manager_or_above() OR employee_id = current_employee_id());

CREATE POLICY "vacations_insert_self_or_manager"
  ON vacations FOR INSERT
  WITH CHECK (is_manager_or_above() OR employee_id = current_employee_id());

CREATE POLICY "vacations_update_manager_above_or_pending_own"
  ON vacations FOR UPDATE
  USING (
    is_manager_or_above()
    OR (employee_id = current_employee_id() AND status = 'pending')
  )
  WITH CHECK (
    is_manager_or_above()
    OR (employee_id = current_employee_id() AND status = 'pending')
  );

CREATE POLICY "vacations_delete_manager_above_or_pending_own"
  ON vacations FOR DELETE
  USING (
    is_manager_or_above()
    OR (employee_id = current_employee_id() AND status = 'pending')
  );

-- availabilities
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availabilities_select_manager_above_or_own"
  ON availabilities FOR SELECT
  USING (is_manager_or_above() OR employee_id = current_employee_id());

CREATE POLICY "availabilities_insert_self_or_manager"
  ON availabilities FOR INSERT
  WITH CHECK (is_manager_or_above() OR employee_id = current_employee_id());

CREATE POLICY "availabilities_update_self_or_manager"
  ON availabilities FOR UPDATE
  USING (is_manager_or_above() OR employee_id = current_employee_id())
  WITH CHECK (is_manager_or_above() OR employee_id = current_employee_id());

CREATE POLICY "availabilities_delete_self_or_manager"
  ON availabilities FOR DELETE
  USING (is_manager_or_above() OR employee_id = current_employee_id());

-- incompatibilities
ALTER TABLE incompatibilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incompatibilities_select_manager_above"
  ON incompatibilities FOR SELECT
  USING (is_manager_or_above());

CREATE POLICY "incompatibilities_insert_manager_above"
  ON incompatibilities FOR INSERT
  WITH CHECK (is_manager_or_above());

CREATE POLICY "incompatibilities_update_manager_above"
  ON incompatibilities FOR UPDATE
  USING (is_manager_or_above())
  WITH CHECK (is_manager_or_above());

CREATE POLICY "incompatibilities_delete_manager_above"
  ON incompatibilities FOR DELETE
  USING (is_manager_or_above());

-- on_call_assignments
ALTER TABLE on_call_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "on_call_select_manager_above_or_own"
  ON on_call_assignments FOR SELECT
  USING (is_manager_or_above() OR employee_id = current_employee_id());

CREATE POLICY "on_call_insert_manager_above"
  ON on_call_assignments FOR INSERT
  WITH CHECK (is_manager_or_above());

CREATE POLICY "on_call_update_manager_above"
  ON on_call_assignments FOR UPDATE
  USING (is_manager_or_above())
  WITH CHECK (is_manager_or_above());

CREATE POLICY "on_call_delete_manager_above"
  ON on_call_assignments FOR DELETE
  USING (is_manager_or_above());

-- shift_swaps
ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_swaps_select_involved_or_manager"
  ON shift_swaps FOR SELECT
  USING (
    is_manager_or_above()
    OR EXISTS (
      SELECT 1 FROM shifts s
      WHERE (s.id = requester_shift_id OR s.id = proposed_shift_id)
        AND s.employee_id = current_employee_id()
    )
  );

CREATE POLICY "shift_swaps_insert_own_shift"
  ON shift_swaps FOR INSERT
  WITH CHECK (
    is_manager_or_above()
    OR EXISTS (
      SELECT 1 FROM shifts s
      WHERE s.id = requester_shift_id
        AND s.employee_id = current_employee_id()
    )
  );

CREATE POLICY "shift_swaps_update_manager_above"
  ON shift_swaps FOR UPDATE
  USING (is_manager_or_above())
  WITH CHECK (is_manager_or_above());

CREATE POLICY "shift_swaps_delete_manager_above"
  ON shift_swaps FOR DELETE
  USING (is_manager_or_above());

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own_or_manager"
  ON notifications FOR SELECT
  USING (is_manager_or_above() OR recipient_id = current_employee_id());

CREATE POLICY "notifications_insert_manager_above"
  ON notifications FOR INSERT
  WITH CHECK (is_manager_or_above());

CREATE POLICY "notifications_update_own_status_or_manager"
  ON notifications FOR UPDATE
  USING (is_manager_or_above() OR recipient_id = current_employee_id())
  WITH CHECK (is_manager_or_above() OR recipient_id = current_employee_id());

CREATE POLICY "notifications_delete_admin"
  ON notifications FOR DELETE
  USING (is_admin());

-- notification_templates
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_templates_select_manager_above"
  ON notification_templates FOR SELECT
  USING (is_manager_or_above());

CREATE POLICY "notification_templates_insert_admin"
  ON notification_templates FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "notification_templates_update_admin"
  ON notification_templates FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "notification_templates_delete_admin"
  ON notification_templates FOR DELETE
  USING (is_admin());

-- audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_admin"
  ON audit_logs FOR SELECT
  USING (is_admin());

CREATE POLICY "audit_logs_insert_manager_above"
  ON audit_logs FOR INSERT
  WITH CHECK (is_manager_or_above());

-- No UPDATE or DELETE on audit_logs — immutable trail
