export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================================
// ENUMS
// ============================================================

export type ContractType = 'full_time' | 'part_time' | 'on_call'
export type AppRole = 'admin' | 'manager' | 'employee'
export type SlotType = 'prep' | 'service' | 'cleanup'
export type ScheduleStatus = 'draft' | 'published' | 'archived'
export type ShiftStatus = 'draft' | 'published' | 'confirmed' | 'completed' | 'cancelled'
export type VacationType = 'ferie' | 'permesso' | 'malattia' | 'altro'
export type VacationStatus = 'pending' | 'approved' | 'rejected'
export type AvailabilityPreference = 'available' | 'preferred' | 'unavailable'
export type SwapStatus = 'pending' | 'approved' | 'rejected'
export type NotificationChannel = 'email' | 'push' | 'in_app'
export type NotificationStatus = 'pending' | 'sent' | 'read'

// ============================================================
// DATABASE TYPE
// ============================================================

export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string
          user_id: string | null
          first_name: string
          last_name: string
          email: string
          phone: string | null
          contract_type: ContractType | null
          weekly_hours_contract: number | null
          hire_date: string | null
          is_active: boolean
          app_role: AppRole
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          contract_type?: ContractType | null
          weekly_hours_contract?: number | null
          hire_date?: string | null
          is_active?: boolean
          app_role?: AppRole
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          contract_type?: ContractType | null
          weekly_hours_contract?: number | null
          hire_date?: string | null
          is_active?: boolean
          app_role?: AppRole
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'employees_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }

      roles: {
        Row: {
          id: string
          name: string
          description: string | null
          color: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          color?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          color?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }

      employee_roles: {
        Row: {
          employee_id: string
          role_id: string
          is_primary: boolean
          proficiency_level: number | null
        }
        Insert: {
          employee_id: string
          role_id: string
          is_primary?: boolean
          proficiency_level?: number | null
        }
        Update: {
          employee_id?: string
          role_id?: string
          is_primary?: boolean
          proficiency_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'employee_roles_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'employee_roles_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          }
        ]
      }

      time_slots: {
        Row: {
          id: string
          name: string
          start_time: string
          end_time: string
          slot_type: SlotType
          day_of_week: number[]
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          start_time: string
          end_time: string
          slot_type?: SlotType
          day_of_week?: number[]
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          start_time?: string
          end_time?: string
          slot_type?: SlotType
          day_of_week?: number[]
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }

      service_requirements: {
        Row: {
          id: string
          time_slot_id: string
          role_id: string
          min_count: number
          ideal_count: number
        }
        Insert: {
          id?: string
          time_slot_id: string
          role_id: string
          min_count?: number
          ideal_count?: number
        }
        Update: {
          id?: string
          time_slot_id?: string
          role_id?: string
          min_count?: number
          ideal_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'service_requirements_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_requirements_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          }
        ]
      }

      schedules: {
        Row: {
          id: string
          week_start: string
          week_end: string
          status: ScheduleStatus
          published_at: string | null
          published_by: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          week_start: string
          week_end: string
          status?: ScheduleStatus
          published_at?: string | null
          published_by?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          week_start?: string
          week_end?: string
          status?: ScheduleStatus
          published_at?: string | null
          published_by?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'schedules_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'schedules_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          }
        ]
      }

      shifts: {
        Row: {
          id: string
          schedule_id: string
          employee_id: string | null
          time_slot_id: string | null
          role_id: string | null
          date: string
          actual_start: string | null
          actual_end: string | null
          status: ShiftStatus
          is_split_shift: boolean
          split_group_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          schedule_id: string
          employee_id?: string | null
          time_slot_id?: string | null
          role_id?: string | null
          date: string
          actual_start?: string | null
          actual_end?: string | null
          status?: ShiftStatus
          is_split_shift?: boolean
          split_group_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string
          employee_id?: string | null
          time_slot_id?: string | null
          role_id?: string | null
          date?: string
          actual_start?: string | null
          actual_end?: string | null
          status?: ShiftStatus
          is_split_shift?: boolean
          split_group_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shifts_schedule_id_fkey'
            columns: ['schedule_id']
            isOneToOne: false
            referencedRelation: 'schedules'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shifts_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shifts_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shifts_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          }
        ]
      }

      vacations: {
        Row: {
          id: string
          employee_id: string
          start_date: string
          end_date: string
          type: VacationType
          status: VacationStatus
          reason: string | null
          requested_at: string
          reviewed_by: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          start_date: string
          end_date: string
          type?: VacationType
          status?: VacationStatus
          reason?: string | null
          requested_at?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          start_date?: string
          end_date?: string
          type?: VacationType
          status?: VacationStatus
          reason?: string | null
          requested_at?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'vacations_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vacations_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          }
        ]
      }

      availabilities: {
        Row: {
          id: string
          employee_id: string
          day_of_week: number | null
          time_slot_id: string | null
          preference: AvailabilityPreference
        }
        Insert: {
          id?: string
          employee_id: string
          day_of_week?: number | null
          time_slot_id?: string | null
          preference?: AvailabilityPreference
        }
        Update: {
          id?: string
          employee_id?: string
          day_of_week?: number | null
          time_slot_id?: string | null
          preference?: AvailabilityPreference
        }
        Relationships: [
          {
            foreignKeyName: 'availabilities_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availabilities_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          }
        ]
      }

      incompatibilities: {
        Row: {
          id: string
          employee_a_id: string
          employee_b_id: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_a_id: string
          employee_b_id: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_a_id?: string
          employee_b_id?: string
          reason?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'incompatibilities_employee_a_id_fkey'
            columns: ['employee_a_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'incompatibilities_employee_b_id_fkey'
            columns: ['employee_b_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          }
        ]
      }

      on_call_assignments: {
        Row: {
          id: string
          employee_id: string
          date: string
          time_slot_id: string | null
          priority: number
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          date: string
          time_slot_id?: string | null
          priority: number
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          date?: string
          time_slot_id?: string | null
          priority?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'on_call_assignments_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'on_call_assignments_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          }
        ]
      }

      shift_swaps: {
        Row: {
          id: string
          requester_shift_id: string
          proposed_shift_id: string | null
          status: SwapStatus
          requested_at: string
          approved_by: string | null
          approved_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          requester_shift_id: string
          proposed_shift_id?: string | null
          status?: SwapStatus
          requested_at?: string
          approved_by?: string | null
          approved_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          requester_shift_id?: string
          proposed_shift_id?: string | null
          status?: SwapStatus
          requested_at?: string
          approved_by?: string | null
          approved_at?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'shift_swaps_requester_shift_id_fkey'
            columns: ['requester_shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shift_swaps_proposed_shift_id_fkey'
            columns: ['proposed_shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shift_swaps_approved_by_fkey'
            columns: ['approved_by']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          }
        ]
      }

      notifications: {
        Row: {
          id: string
          recipient_id: string
          type: string
          title: string
          body: string | null
          channel: NotificationChannel
          status: NotificationStatus
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recipient_id: string
          type: string
          title: string
          body?: string | null
          channel?: NotificationChannel
          status?: NotificationStatus
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          recipient_id?: string
          type?: string
          title?: string
          body?: string | null
          channel?: NotificationChannel
          status?: NotificationStatus
          sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_recipient_id_fkey'
            columns: ['recipient_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          }
        ]
      }

      notification_templates: {
        Row: {
          id: string
          type: string
          subject: string
          body_template: string
          channel: NotificationChannel
          is_active: boolean
        }
        Insert: {
          id?: string
          type: string
          subject: string
          body_template: string
          channel?: NotificationChannel
          is_active?: boolean
        }
        Update: {
          id?: string
          type?: string
          subject?: string
          body_template?: string
          channel?: NotificationChannel
          is_active?: boolean
        }
        Relationships: []
      }

      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          old_values: Json | null
          new_values: Json | null
          timestamp: string
          ip_address: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          timestamp?: string
          ip_address?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          timestamp?: string
          ip_address?: string | null
        }
        Relationships: []
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_manager_or_above: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_employee_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }

    Enums: {
      contract_type_enum: ContractType
      app_role_enum: AppRole
      slot_type_enum: SlotType
      schedule_status_enum: ScheduleStatus
      shift_status_enum: ShiftStatus
      vacation_type_enum: VacationType
      vacation_status_enum: VacationStatus
      availability_preference_enum: AvailabilityPreference
      swap_status_enum: SwapStatus
      notification_channel_enum: NotificationChannel
      notification_status_enum: NotificationStatus
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================
// CONVENIENCE ROW TYPES
// ============================================================

export type Employee = Database['public']['Tables']['employees']['Row']
export type Role = Database['public']['Tables']['roles']['Row']
export type TimeSlot = Database['public']['Tables']['time_slots']['Row']
export type Shift = Database['public']['Tables']['shifts']['Row']
export type Schedule = Database['public']['Tables']['schedules']['Row']
export type Vacation = Database['public']['Tables']['vacations']['Row']
export type Availability = Database['public']['Tables']['availabilities']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type ShiftSwap = Database['public']['Tables']['shift_swaps']['Row']
export type OnCallAssignment = Database['public']['Tables']['on_call_assignments']['Row']
export type ServiceRequirement = Database['public']['Tables']['service_requirements']['Row']
export type Incompatibility = Database['public']['Tables']['incompatibilities']['Row']
export type NotificationTemplate = Database['public']['Tables']['notification_templates']['Row']
export type EmployeeRole = Database['public']['Tables']['employee_roles']['Row']

// ============================================================
// CONVENIENCE INSERT TYPES
// ============================================================

export type EmployeeInsert = Database['public']['Tables']['employees']['Insert']
export type RoleInsert = Database['public']['Tables']['roles']['Insert']
export type TimeSlotInsert = Database['public']['Tables']['time_slots']['Insert']
export type ShiftInsert = Database['public']['Tables']['shifts']['Insert']
export type ScheduleInsert = Database['public']['Tables']['schedules']['Insert']
export type VacationInsert = Database['public']['Tables']['vacations']['Insert']
export type AvailabilityInsert = Database['public']['Tables']['availabilities']['Insert']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']
export type ShiftSwapInsert = Database['public']['Tables']['shift_swaps']['Insert']
export type OnCallAssignmentInsert = Database['public']['Tables']['on_call_assignments']['Insert']
export type ServiceRequirementInsert = Database['public']['Tables']['service_requirements']['Insert']
export type IncompatibilityInsert = Database['public']['Tables']['incompatibilities']['Insert']
export type NotificationTemplateInsert = Database['public']['Tables']['notification_templates']['Insert']
export type EmployeeRoleInsert = Database['public']['Tables']['employee_roles']['Insert']

// ============================================================
// CONVENIENCE UPDATE TYPES
// ============================================================

export type EmployeeUpdate = Database['public']['Tables']['employees']['Update']
export type RoleUpdate = Database['public']['Tables']['roles']['Update']
export type TimeSlotUpdate = Database['public']['Tables']['time_slots']['Update']
export type ShiftUpdate = Database['public']['Tables']['shifts']['Update']
export type ScheduleUpdate = Database['public']['Tables']['schedules']['Update']
export type VacationUpdate = Database['public']['Tables']['vacations']['Update']
export type AvailabilityUpdate = Database['public']['Tables']['availabilities']['Update']
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update']
export type ShiftSwapUpdate = Database['public']['Tables']['shift_swaps']['Update']
export type OnCallAssignmentUpdate = Database['public']['Tables']['on_call_assignments']['Update']
export type ServiceRequirementUpdate = Database['public']['Tables']['service_requirements']['Update']
export type IncompatibilityUpdate = Database['public']['Tables']['incompatibilities']['Update']
export type NotificationTemplateUpdate = Database['public']['Tables']['notification_templates']['Update']
export type EmployeeRoleUpdate = Database['public']['Tables']['employee_roles']['Update']
