'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { AppRole, ContractType, Json } from '@/lib/supabase/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJson(v: unknown): Json { return v as any }

export interface EmployeeInput {
  first_name: string
  last_name: string
  email: string
  phone?: string
  contract_type: ContractType
  weekly_hours_contract: number
  hire_date?: string
  app_role?: AppRole
  preferred_rest_days?: number[]
  roles?: Array<{ role_id: string; is_primary: boolean; proficiency_level: number }>
}

export async function createEmployee(data: EmployeeInput): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()

  const { data: emp, error } = await supabase
    .from('employees')
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      contract_type: data.contract_type,
      weekly_hours_contract: data.weekly_hours_contract,
      hire_date: data.hire_date,
      app_role: data.app_role ?? 'employee',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preferred_rest_days: (data.preferred_rest_days ?? []) as any,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (data.roles && data.roles.length > 0) {
    await supabase.from('employee_roles').insert(
      data.roles.map((r) => ({ employee_id: emp.id, ...r }))
    )
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    await supabase.from('audit_logs').insert({
      user_id: session.user.id,
      action: 'INSERT',
      entity_type: 'employees',
      entity_id: emp.id,
      new_values: toJson({ ...data }),
    })
  }

  revalidatePath('/dashboard/dipendenti')
  return { id: emp.id }
}

export async function updateEmployee(id: string, data: Partial<EmployeeInput>): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { roles, ...fields } = data

  const { error } = await supabase
    .from('employees')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  if (roles !== undefined) {
    await supabase.from('employee_roles').delete().eq('employee_id', id)
    if (roles.length > 0) {
      await supabase.from('employee_roles').insert(
        roles.map((r) => ({ employee_id: id, ...r }))
      )
    }
  }

  revalidatePath('/dashboard/dipendenti')
  revalidatePath(`/dashboard/dipendenti/${id}`)
  return {}
}

export async function bulkToggleActive(ids: string[], is_active: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('employees')
    .update({ is_active, updated_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/dipendenti')
  return {}
}

export async function toggleEmployeeActive(id: string, is_active: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('employees')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/dipendenti')
  revalidatePath(`/dashboard/dipendenti/${id}`)
  return {}
}

export async function addIncompatibility(
  employeeAId: string,
  employeeBId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // The table enforces employee_a_id < employee_b_id — always insert in sorted order
  const [a, b] = [employeeAId, employeeBId].sort()

  // Avoid duplicates
  const { data: existing } = await supabase
    .from('incompatibilities')
    .select('id')
    .eq('employee_a_id', a)
    .eq('employee_b_id', b)
    .maybeSingle()

  if (existing) return {}

  const { error } = await supabase
    .from('incompatibilities')
    .insert({ employee_a_id: a, employee_b_id: b })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/dipendenti/${employeeAId}`)
  revalidatePath(`/dashboard/dipendenti/${employeeBId}`)
  return {}
}

export async function removeIncompatibility(
  employeeAId: string,
  employeeBId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('incompatibilities')
    .delete()
    .or(
      `and(employee_a_id.eq.${employeeAId},employee_b_id.eq.${employeeBId}),` +
      `and(employee_a_id.eq.${employeeBId},employee_b_id.eq.${employeeAId})`
    )

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/dipendenti/${employeeAId}`)
  revalidatePath(`/dashboard/dipendenti/${employeeBId}`)
  return {}
}
