export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      almoxarifados: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          customer_id: string
          descricao: string | null
          id: string
          nome: string
          obra_id: string | null
          principal: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          customer_id: string
          descricao?: string | null
          id?: string
          nome: string
          obra_id?: string | null
          principal?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string
          descricao?: string | null
          id?: string
          nome?: string
          obra_id?: string | null
          principal?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      app_releases: {
        Row: {
          created_at: string
          created_by: string | null
          highlight: string | null
          id: string
          items: Json
          released_at: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          highlight?: string | null
          id?: string
          items?: Json
          released_at?: string
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          highlight?: string | null
          id?: string
          items?: Json
          released_at?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      auth_email_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token_hash: string
          type: string
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token_hash: string
          type: string
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
          type?: string
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cartoes: {
        Row: {
          ativo: boolean
          bandeira: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          dia_fechamento: number
          dia_vencimento: number
          empresa_id: string | null
          id: string
          limite: number
          nome: string
          ultimos_4: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bandeira?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          dia_fechamento?: number
          dia_vencimento?: number
          empresa_id?: string | null
          id?: string
          limite?: number
          nome: string
          ultimos_4?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bandeira?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          dia_fechamento?: number
          dia_vencimento?: number
          empresa_id?: string | null
          id?: string
          limite?: number
          nome?: string
          ultimos_4?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          customer_id: string
          id: string
          nome: string
          parent_id: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          customer_id: string
          id?: string
          nome: string
          parent_id?: string | null
          tipo: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          nome?: string
          parent_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_obras: {
        Row: {
          colaborador_id: string
          created_at: string
          customer_id: string
          data_fim: string | null
          data_inicio: string | null
          id: string
          obra_id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          customer_id: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          obra_id: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          customer_id?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          obra_id?: string
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          ativo: boolean
          cargo: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          ctps: string | null
          customer_id: string
          data_entrada: string | null
          data_saida: string | null
          deleted_at: string | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          foto_url: string | null
          id: string
          nome: string
          observacoes: string | null
          pix: string | null
          remuneracao: number
          telefone: string | null
          updated_at: string
          vinculo: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          ctps?: string | null
          customer_id: string
          data_entrada?: string | null
          data_saida?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          pix?: string | null
          remuneracao?: number
          telefone?: string | null
          updated_at?: string
          vinculo?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          ctps?: string | null
          customer_id?: string
          data_entrada?: string | null
          data_saida?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          pix?: string | null
          remuneracao?: number
          telefone?: string | null
          updated_at?: string
          vinculo?: string
        }
        Relationships: []
      }
      communications_log: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string
          customer_id: string
          error: string | null
          id: string
          invoice_id: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["communication_status"]
          subject: string | null
          trigger: Database["public"]["Enums"]["communication_trigger"]
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          customer_id: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_status"]
          subject?: string | null
          trigger: Database["public"]["Enums"]["communication_trigger"]
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          customer_id?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_status"]
          subject?: string | null
          trigger?: Database["public"]["Enums"]["communication_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "communications_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_itens: {
        Row: {
          compra_id: string
          created_at: string
          customer_id: string
          descricao: string
          etapa_id: string | null
          id: string
          produto_id: string | null
          qtd_medida: number
          qtd_recebida: number
          quantidade: number
          subetapa_id: string | null
          unidade: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          compra_id: string
          created_at?: string
          customer_id: string
          descricao: string
          etapa_id?: string | null
          id?: string
          produto_id?: string | null
          qtd_medida?: number
          qtd_recebida?: number
          quantidade?: number
          subetapa_id?: string | null
          unidade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          compra_id?: string
          created_at?: string
          customer_id?: string
          descricao?: string
          etapa_id?: string | null
          id?: string
          produto_id?: string | null
          qtd_medida?: number
          qtd_recebida?: number
          quantidade?: number
          subetapa_id?: string | null
          unidade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: []
      }
      compra_notas_fiscais: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          chave: string | null
          compra_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          emitida_em: string | null
          id: string
          numero: string | null
          observacoes: string | null
          serie: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          chave?: string | null
          compra_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          emitida_em?: string | null
          id?: string
          numero?: string | null
          observacoes?: string | null
          serie?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          chave?: string | null
          compra_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          emitida_em?: string | null
          id?: string
          numero?: string | null
          observacoes?: string | null
          serie?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compra_notas_fiscais_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_parcelas: {
        Row: {
          compra_id: string
          created_at: string
          customer_id: string
          fatura_cartao_id: string | null
          id: string
          numero: number
          pago_em: string | null
          status: string
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          compra_id: string
          created_at?: string
          customer_id: string
          fatura_cartao_id?: string | null
          id?: string
          numero: number
          pago_em?: string | null
          status?: string
          updated_at?: string
          valor?: number
          vencimento: string
        }
        Update: {
          compra_id?: string
          created_at?: string
          customer_id?: string
          fatura_cartao_id?: string | null
          id?: string
          numero?: number
          pago_em?: string | null
          status?: string
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: []
      }
      compras: {
        Row: {
          aprovacao_status: string
          aprovado_em: string | null
          aprovado_por: string | null
          cartao_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          data_compra: string
          data_primeira_parcela: string | null
          descricao: string | null
          etapa_id: string | null
          forma_pagamento: string
          fornecedor_id: string | null
          id: string
          numero: string | null
          obra_id: string
          observacoes: string | null
          qtd_parcelas: number
          rejeicao_motivo: string | null
          status: string
          subetapa_id: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          cartao_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          data_compra?: string
          data_primeira_parcela?: string | null
          descricao?: string | null
          etapa_id?: string | null
          forma_pagamento?: string
          fornecedor_id?: string | null
          id?: string
          numero?: string | null
          obra_id: string
          observacoes?: string | null
          qtd_parcelas?: number
          rejeicao_motivo?: string | null
          status?: string
          subetapa_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Update: {
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          cartao_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          data_compra?: string
          data_primeira_parcela?: string | null
          descricao?: string | null
          etapa_id?: string | null
          forma_pagamento?: string
          fornecedor_id?: string | null
          id?: string
          numero?: string | null
          obra_id?: string
          observacoes?: string | null
          qtd_parcelas?: number
          rejeicao_motivo?: string | null
          status?: string
          subetapa_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "orcamento_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_subetapa_id_fkey"
            columns: ["subetapa_id"]
            isOneToOne: false
            referencedRelation: "orcamento_subetapas"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacao_extratos: {
        Row: {
          arquivo_nome: string | null
          conta_bancaria_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          formato: string
          id: string
          periodo_fim: string | null
          periodo_inicio: string | null
          status: string
        }
        Insert: {
          arquivo_nome?: string | null
          conta_bancaria_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          formato?: string
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string
        }
        Update: {
          arquivo_nome?: string | null
          conta_bancaria_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          formato?: string
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string
        }
        Relationships: []
      }
      conciliacao_itens: {
        Row: {
          created_at: string
          customer_id: string
          data: string
          descricao: string | null
          extrato_id: string
          id: string
          lancamento_id: string | null
          match_status: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          data: string
          descricao?: string | null
          extrato_id: string
          id?: string
          lancamento_id?: string | null
          match_status?: string
          tipo: string
          valor: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          data?: string
          descricao?: string | null
          extrato_id?: string
          id?: string
          lancamento_id?: string | null
          match_status?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_itens_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "conciliacao_extratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_itens_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          conta: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          empresa_id: string | null
          id: string
          nome: string
          saldo_atual: number
          saldo_inicial: number
          tipo: string
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          empresa_id?: string | null
          id?: string
          nome: string
          saldo_atual?: number
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          saldo_atual?: number
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      contas_pagar: {
        Row: {
          categoria_id: string | null
          compra_id: string | null
          compra_parcela_id: string | null
          conta_bancaria_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          descricao: string
          empresa_id: string | null
          estornado: boolean
          estornado_em: string | null
          estornado_por: string | null
          estorno_token: string | null
          fatura_cartao_id: string | null
          fornecedor_id: string | null
          id: string
          motivo_estorno: string | null
          obra_id: string | null
          observacoes: string | null
          origem: string
          pago_em: string | null
          status: string
          updated_at: string
          valor: number
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          categoria_id?: string | null
          compra_id?: string | null
          compra_parcela_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          descricao: string
          empresa_id?: string | null
          estornado?: boolean
          estornado_em?: string | null
          estornado_por?: string | null
          estorno_token?: string | null
          fatura_cartao_id?: string | null
          fornecedor_id?: string | null
          id?: string
          motivo_estorno?: string | null
          obra_id?: string | null
          observacoes?: string | null
          origem?: string
          pago_em?: string | null
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
          vencimento: string
        }
        Update: {
          categoria_id?: string | null
          compra_id?: string | null
          compra_parcela_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          descricao?: string
          empresa_id?: string | null
          estornado?: boolean
          estornado_em?: string | null
          estornado_por?: string | null
          estorno_token?: string | null
          fatura_cartao_id?: string | null
          fornecedor_id?: string | null
          id?: string
          motivo_estorno?: string | null
          obra_id?: string | null
          observacoes?: string | null
          origem?: string
          pago_em?: string | null
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_receber: {
        Row: {
          categoria_id: string | null
          conta_bancaria_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          descricao: string
          empresa_id: string | null
          estornado: boolean
          estornado_em: string | null
          estornado_por: string | null
          estorno_token: string | null
          id: string
          medicao_obra_id: string | null
          motivo_estorno: string | null
          obra_id: string | null
          observacoes: string | null
          origem: string
          recebido_em: string | null
          status: string
          updated_at: string
          valor: number
          valor_recebido: number | null
          vencimento: string
        }
        Insert: {
          categoria_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          descricao: string
          empresa_id?: string | null
          estornado?: boolean
          estornado_em?: string | null
          estornado_por?: string | null
          estorno_token?: string | null
          id?: string
          medicao_obra_id?: string | null
          motivo_estorno?: string | null
          obra_id?: string | null
          observacoes?: string | null
          origem?: string
          recebido_em?: string | null
          status?: string
          updated_at?: string
          valor?: number
          valor_recebido?: number | null
          vencimento: string
        }
        Update: {
          categoria_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          descricao?: string
          empresa_id?: string | null
          estornado?: boolean
          estornado_em?: string | null
          estornado_por?: string | null
          estorno_token?: string | null
          id?: string
          medicao_obra_id?: string | null
          motivo_estorno?: string | null
          obra_id?: string | null
          observacoes?: string | null
          origem?: string
          recebido_em?: string | null
          status?: string
          updated_at?: string
          valor?: number
          valor_recebido?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_receber_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_medicao_obra_id_fkey"
            columns: ["medicao_obra_id"]
            isOneToOne: false
            referencedRelation: "medicoes_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_action_costs: {
        Row: {
          action_key: string
          ativo: boolean
          created_at: string
          custo: number
          descricao: string
          id: string
          updated_at: string
        }
        Insert: {
          action_key: string
          ativo?: boolean
          created_at?: string
          custo: number
          descricao: string
          id?: string
          updated_at?: string
        }
        Update: {
          action_key?: string
          ativo?: boolean
          created_at?: string
          custo?: number
          descricao?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_packages: {
        Row: {
          ativo: boolean
          created_at: string
          creditos: number
          destaque: boolean
          id: string
          nome: string
          ordem: number
          updated_at: string
          valor_brl: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          creditos: number
          destaque?: boolean
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          valor_brl: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          creditos?: number
          destaque?: boolean
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          valor_brl?: number
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          action_key: string | null
          created_at: string
          customer_id: string
          delta: number
          descricao: string | null
          id: string
          invoice_id: string | null
          saldo_apos: number
          tipo: Database["public"]["Enums"]["credit_tx_type"]
          user_id: string | null
        }
        Insert: {
          action_key?: string | null
          created_at?: string
          customer_id: string
          delta: number
          descricao?: string | null
          id?: string
          invoice_id?: string | null
          saldo_apos: number
          tipo: Database["public"]["Enums"]["credit_tx_type"]
          user_id?: string | null
        }
        Update: {
          action_key?: string | null
          created_at?: string
          customer_id?: string
          delta?: number
          descricao?: string | null
          id?: string
          invoice_id?: string | null
          saldo_apos?: number
          tipo?: Database["public"]["Enums"]["credit_tx_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credits: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          saldo: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          saldo?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          saldo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invites: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          allowed_obras: string[]
          can_access_all_obras: boolean
          created_at: string
          created_by: string | null
          customer_id: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          permissions: Json
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          allowed_obras?: string[]
          can_access_all_obras?: boolean
          created_at?: string
          created_by?: string | null
          customer_id: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          permissions?: Json
          role?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          allowed_obras?: string[]
          can_access_all_obras?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          permissions?: Json
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_invites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_members: {
        Row: {
          allowed_obras: string[]
          can_access_all_obras: boolean
          created_at: string
          created_by: string | null
          customer_id: string
          email: string | null
          full_name: string | null
          id: string
          permissions: Json
          pode_aprovar_compras: boolean
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_obras?: string[]
          can_access_all_obras?: boolean
          created_at?: string
          created_by?: string | null
          customer_id: string
          email?: string | null
          full_name?: string | null
          id?: string
          permissions?: Json
          pode_aprovar_compras?: boolean
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_obras?: string[]
          can_access_all_obras?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string
          email?: string | null
          full_name?: string | null
          id?: string
          permissions?: Json
          pode_aprovar_compras?: boolean
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          alerta_subetapa_pct: number
          asaas_customer_id: string | null
          company_name: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          limite_aprovacao_compra: number
          name: string
          notes: string | null
          onboarding_completed_at: string | null
          owner_user_id: string | null
          phone: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          alerta_subetapa_pct?: number
          asaas_customer_id?: string | null
          company_name?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          limite_aprovacao_compra?: number
          name: string
          notes?: string | null
          onboarding_completed_at?: string | null
          owner_user_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          alerta_subetapa_pct?: number
          asaas_customer_id?: string | null
          company_name?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          limite_aprovacao_compra?: number
          name?: string
          notes?: string | null
          onboarding_completed_at?: string | null
          owner_user_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      estoque_movimentacoes: {
        Row: {
          almoxarifado_destino_id: string | null
          almoxarifado_id: string
          created_at: string
          created_by: string | null
          custo_unitario: number
          customer_id: string
          data: string
          estorno_token: string | null
          id: string
          obra_id: string | null
          observacoes: string | null
          origem: string
          produto_id: string
          quantidade: number
          recebimento_id: string | null
          requisicao_id: string | null
          tipo: string
        }
        Insert: {
          almoxarifado_destino_id?: string | null
          almoxarifado_id: string
          created_at?: string
          created_by?: string | null
          custo_unitario?: number
          customer_id: string
          data?: string
          estorno_token?: string | null
          id?: string
          obra_id?: string | null
          observacoes?: string | null
          origem?: string
          produto_id: string
          quantidade: number
          recebimento_id?: string | null
          requisicao_id?: string | null
          tipo: string
        }
        Update: {
          almoxarifado_destino_id?: string | null
          almoxarifado_id?: string
          created_at?: string
          created_by?: string | null
          custo_unitario?: number
          customer_id?: string
          data?: string
          estorno_token?: string | null
          id?: string
          obra_id?: string | null
          observacoes?: string | null
          origem?: string
          produto_id?: string
          quantidade?: number
          recebimento_id?: string | null
          requisicao_id?: string | null
          tipo?: string
        }
        Relationships: []
      }
      estoque_saldos: {
        Row: {
          almoxarifado_id: string
          custo_medio: number
          customer_id: string
          id: string
          produto_id: string
          quantidade: number
          updated_at: string
        }
        Insert: {
          almoxarifado_id: string
          custo_medio?: number
          customer_id: string
          id?: string
          produto_id: string
          quantidade?: number
          updated_at?: string
        }
        Update: {
          almoxarifado_id?: string
          custo_medio?: number
          customer_id?: string
          id?: string
          produto_id?: string
          quantidade?: number
          updated_at?: string
        }
        Relationships: []
      }
      eventos_agenda: {
        Row: {
          cor: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          descricao: string | null
          dia_inteiro: boolean
          dt_fim: string
          dt_inicio: string
          id: string
          lembrete_minutos: number | null
          local: string | null
          obra_id: string | null
          tarefa_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          descricao?: string | null
          dia_inteiro?: boolean
          dt_fim: string
          dt_inicio: string
          id?: string
          lembrete_minutos?: number | null
          local?: string | null
          obra_id?: string | null
          tarefa_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          descricao?: string | null
          dia_inteiro?: boolean
          dt_fim?: string
          dt_inicio?: string
          id?: string
          lembrete_minutos?: number | null
          local?: string | null
          obra_id?: string | null
          tarefa_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_agenda_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_agenda_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas_cartao: {
        Row: {
          cartao_id: string
          competencia: string
          created_at: string
          customer_id: string
          dt_fechamento: string
          dt_vencimento: string
          id: string
          pago_em: string | null
          status: string
          updated_at: string
          valor_pago: number
          valor_total: number
        }
        Insert: {
          cartao_id: string
          competencia: string
          created_at?: string
          customer_id: string
          dt_fechamento: string
          dt_vencimento: string
          id?: string
          pago_em?: string | null
          status?: string
          updated_at?: string
          valor_pago?: number
          valor_total?: number
        }
        Update: {
          cartao_id?: string
          competencia?: string
          created_at?: string
          customer_id?: string
          dt_fechamento?: string
          dt_vencimento?: string
          id?: string
          pago_em?: string | null
          status?: string
          updated_at?: string
          valor_pago?: number
          valor_total?: number
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          contato: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          pix_chave: string | null
          pix_tipo: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      funcoes_equipe_obra: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          nome: string
          obra_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          nome: string
          obra_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          nome?: string
          obra_id?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          last_test_at: string | null
          last_test_status: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_status?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_status?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          bank_slip_url: string | null
          created_at: string
          customer_id: string
          description: string | null
          due_date: string
          id: string
          invoice_url: string | null
          paid_at: string | null
          payment_link: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          due_date: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          payment_link?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          payment_link?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          categoria_id: string | null
          conciliado: boolean
          conta_bancaria_id: string
          conta_pagar_id: string | null
          conta_receber_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          data: string
          descricao: string
          estornado: boolean
          estorno_token: string | null
          id: string
          obra_id: string | null
          tipo: string
          transferencia_id: string | null
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          conciliado?: boolean
          conta_bancaria_id: string
          conta_pagar_id?: string | null
          conta_receber_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          data?: string
          descricao: string
          estornado?: boolean
          estorno_token?: string | null
          id?: string
          obra_id?: string | null
          tipo: string
          transferencia_id?: string | null
          valor?: number
        }
        Update: {
          categoria_id?: string | null
          conciliado?: boolean
          conta_bancaria_id?: string
          conta_pagar_id?: string | null
          conta_receber_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          data?: string
          descricao?: string
          estornado?: boolean
          estorno_token?: string | null
          id?: string
          obra_id?: string | null
          tipo?: string
          transferencia_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
        ]
      }
      medicao_itens: {
        Row: {
          compra_item_id: string
          created_at: string
          customer_id: string
          id: string
          medicao_id: string
          quantidade: number
          valor: number
        }
        Insert: {
          compra_item_id: string
          created_at?: string
          customer_id: string
          id?: string
          medicao_id: string
          quantidade?: number
          valor?: number
        }
        Update: {
          compra_item_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          medicao_id?: string
          quantidade?: number
          valor?: number
        }
        Relationships: []
      }
      medicao_obra_itens: {
        Row: {
          created_at: string
          customer_id: string
          descricao: string
          etapa_id: string | null
          id: string
          medicao_obra_id: string
          percentual: number
          subetapa_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          descricao: string
          etapa_id?: string | null
          id?: string
          medicao_obra_id: string
          percentual?: number
          subetapa_id?: string | null
          valor?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          descricao?: string
          etapa_id?: string | null
          id?: string
          medicao_obra_id?: string
          percentual?: number
          subetapa_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicao_obra_itens_medicao_obra_id_fkey"
            columns: ["medicao_obra_id"]
            isOneToOne: false
            referencedRelation: "medicoes_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      medicoes: {
        Row: {
          compra_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          data: string
          id: string
          numero: number
          observacoes: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          compra_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          data?: string
          id?: string
          numero?: number
          observacoes?: string | null
          updated_at?: string
          valor_total?: number
        }
        Update: {
          compra_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          data?: string
          id?: string
          numero?: number
          observacoes?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: []
      }
      medicoes_obra: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          data: string
          id: string
          numero: number
          obra_id: string
          observacoes: string | null
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          data?: string
          id?: string
          numero?: number
          obra_id: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          data?: string
          id?: string
          numero?: number
          obra_id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string
          id: string
          is_active: boolean
          subject: string | null
          trigger: Database["public"]["Enums"]["communication_trigger"]
          updated_at: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          subject?: string | null
          trigger: Database["public"]["Enums"]["communication_trigger"]
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          subject?: string | null
          trigger?: Database["public"]["Enums"]["communication_trigger"]
          updated_at?: string
        }
        Relationships: []
      }
      obra_documentos: {
        Row: {
          created_at: string
          customer_id: string
          descricao: string | null
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          nome: string
          obra_id: string
          tags: string[]
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          descricao?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          nome: string
          obra_id: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          descricao?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          nome?: string
          obra_id?: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_documentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          contact_email: string | null
          contact_name: string | null
          contact_whatsapp: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          description: string | null
          empresa_id: string | null
          expected_end_date: string | null
          foto_url: string | null
          id: string
          name: string
          portal_ativo: boolean
          portal_token: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          description?: string | null
          empresa_id?: string | null
          expected_end_date?: string | null
          foto_url?: string | null
          id?: string
          name: string
          portal_ativo?: boolean
          portal_token?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string | null
          empresa_id?: string | null
          expected_end_date?: string | null
          foto_url?: string | null
          id?: string
          name?: string
          portal_ativo?: boolean
          portal_token?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_etapas: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          dt_fim_prevista: string | null
          dt_fim_real: string | null
          dt_inicio_prevista: string | null
          dt_inicio_real: string | null
          id: string
          nome: string
          obra_id: string
          ordem: number
          percentual: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          dt_fim_prevista?: string | null
          dt_fim_real?: string | null
          dt_inicio_prevista?: string | null
          dt_inicio_real?: string | null
          id?: string
          nome: string
          obra_id: string
          ordem?: number
          percentual?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          dt_fim_prevista?: string | null
          dt_fim_real?: string | null
          dt_inicio_prevista?: string | null
          dt_inicio_real?: string | null
          id?: string
          nome?: string
          obra_id?: string
          ordem?: number
          percentual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_etapas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_subetapas: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          etapa_id: string
          id: string
          nome: string
          ordem: number
          tipo: string | null
          updated_at: string
          valor_orcado: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          etapa_id: string
          id?: string
          nome: string
          ordem?: number
          tipo?: string | null
          updated_at?: string
          valor_orcado?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          etapa_id?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string | null
          updated_at?: string
          valor_orcado?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_subetapas_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "orcamento_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          cycle: Database["public"]["Enums"]["plan_cycle"]
          description: string | null
          display_order: number
          features: string[]
          id: string
          is_active: boolean
          is_featured: boolean
          limits: Json
          max_usuarios: number
          modules: Json
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle?: Database["public"]["Enums"]["plan_cycle"]
          description?: string | null
          display_order?: number
          features?: string[]
          id?: string
          is_active?: boolean
          is_featured?: boolean
          limits?: Json
          max_usuarios?: number
          modules?: Json
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle?: Database["public"]["Enums"]["plan_cycle"]
          description?: string | null
          display_order?: number
          features?: string[]
          id?: string
          is_active?: boolean
          is_featured?: boolean
          limits?: Json
          max_usuarios?: number
          modules?: Json
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          codigo: string | null
          created_at: string
          created_by: string | null
          custo_medio: number
          customer_id: string
          descricao: string | null
          estoque_minimo: number
          foto_url: string | null
          id: string
          marca: string | null
          ncm: string | null
          nome: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          custo_medio?: number
          customer_id: string
          descricao?: string | null
          estoque_minimo?: number
          foto_url?: string | null
          id?: string
          marca?: string | null
          ncm?: string | null
          nome: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          custo_medio?: number
          customer_id?: string
          descricao?: string | null
          estoque_minimo?: number
          foto_url?: string | null
          id?: string
          marca?: string | null
          ncm?: string | null
          nome?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rdo_anexos: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          legenda: string | null
          obra_id: string
          rdo_id: string
          storage_path: string
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          legenda?: string | null
          obra_id: string
          rdo_id: string
          storage_path: string
          tipo?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          legenda?: string | null
          obra_id?: string
          rdo_id?: string
          storage_path?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_anexos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_atividades: {
        Row: {
          created_at: string
          customer_id: string
          descricao: string
          etapa_id: string | null
          id: string
          percentual: number
          rdo_id: string
          subetapa_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          descricao: string
          etapa_id?: string | null
          id?: string
          percentual?: number
          rdo_id: string
          subetapa_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          descricao?: string
          etapa_id?: string | null
          id?: string
          percentual?: number
          rdo_id?: string
          subetapa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_atividades_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "orcamento_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_atividades_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_atividades_subetapa_id_fkey"
            columns: ["subetapa_id"]
            isOneToOne: false
            referencedRelation: "orcamento_subetapas"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_equipes: {
        Row: {
          created_at: string
          customer_id: string
          empreiteiro: string | null
          funcao: string
          horas: number
          id: string
          quantidade: number
          rdo_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          empreiteiro?: string | null
          funcao: string
          horas?: number
          id?: string
          quantidade?: number
          rdo_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          empreiteiro?: string | null
          funcao?: string
          horas?: number
          id?: string
          quantidade?: number
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_equipes_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_ocorrencias: {
        Row: {
          created_at: string
          customer_id: string
          descricao: string
          id: string
          rdo_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          descricao: string
          id?: string
          rdo_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          descricao?: string
          id?: string
          rdo_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_ocorrencias_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdos: {
        Row: {
          clima_manha: string | null
          clima_noite: string | null
          clima_tarde: string | null
          condicao: string
          created_at: string
          created_by: string | null
          customer_id: string
          data: string
          id: string
          obra_id: string
          observacoes: string | null
          responsavel: string | null
          updated_at: string
        }
        Insert: {
          clima_manha?: string | null
          clima_noite?: string | null
          clima_tarde?: string | null
          condicao?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          data?: string
          id?: string
          obra_id: string
          observacoes?: string | null
          responsavel?: string | null
          updated_at?: string
        }
        Update: {
          clima_manha?: string | null
          clima_noite?: string | null
          clima_tarde?: string | null
          condicao?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          data?: string
          id?: string
          obra_id?: string
          observacoes?: string | null
          responsavel?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recebimento_itens: {
        Row: {
          compra_item_id: string
          created_at: string
          customer_id: string
          id: string
          quantidade: number
          recebimento_id: string
        }
        Insert: {
          compra_item_id: string
          created_at?: string
          customer_id: string
          id?: string
          quantidade?: number
          recebimento_id: string
        }
        Update: {
          compra_item_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          quantidade?: number
          recebimento_id?: string
        }
        Relationships: []
      }
      recebimentos: {
        Row: {
          compra_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          data: string
          id: string
          observacoes: string | null
          recebido_por: string | null
        }
        Insert: {
          compra_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          data?: string
          id?: string
          observacoes?: string | null
          recebido_por?: string | null
        }
        Update: {
          compra_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          data?: string
          id?: string
          observacoes?: string | null
          recebido_por?: string | null
        }
        Relationships: []
      }
      requisicao_itens: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          observacoes: string | null
          produto_id: string
          qtd_atendida: number
          quantidade: number
          requisicao_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          observacoes?: string | null
          produto_id: string
          qtd_atendida?: number
          quantidade?: number
          requisicao_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          observacoes?: string | null
          produto_id?: string
          qtd_atendida?: number
          quantidade?: number
          requisicao_id?: string
        }
        Relationships: []
      }
      requisicoes: {
        Row: {
          almoxarifado_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          data: string
          id: string
          numero: number
          obra_id: string
          observacoes: string | null
          solicitante: string | null
          status: string
          updated_at: string
        }
        Insert: {
          almoxarifado_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          data?: string
          id?: string
          numero?: number
          obra_id: string
          observacoes?: string | null
          solicitante?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          almoxarifado_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          data?: string
          id?: string
          numero?: number
          obra_id?: string
          observacoes?: string | null
          solicitante?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          asaas_subscription_id: string | null
          canceled_at: string | null
          created_at: string
          customer_id: string
          cycle: Database["public"]["Enums"]["plan_cycle"]
          due_day: number
          id: string
          next_due_date: string | null
          plan_id: string
          price: number
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          asaas_subscription_id?: string | null
          canceled_at?: string | null
          created_at?: string
          customer_id: string
          cycle: Database["public"]["Enums"]["plan_cycle"]
          due_day: number
          id?: string
          next_due_date?: string | null
          plan_id: string
          price: number
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          asaas_subscription_id?: string | null
          canceled_at?: string | null
          created_at?: string
          customer_id?: string
          cycle?: Database["public"]["Enums"]["plan_cycle"]
          due_day?: number
          id?: string
          next_due_date?: string | null
          plan_id?: string
          price?: number
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tarefa_colunas: {
        Row: {
          cor: string | null
          created_at: string
          customer_id: string
          id: string
          is_done: boolean
          nome: string
          obra_id: string | null
          ordem: number
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_done?: boolean
          nome: string
          obra_id?: string | null
          ordem?: number
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_done?: boolean
          nome?: string
          obra_id?: string | null
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_colunas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_materiais: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          observacao: string | null
          produto_id: string
          quantidade: number
          tarefa_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          observacao?: string | null
          produto_id: string
          quantidade?: number
          tarefa_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_materiais_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_materiais_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          coluna_id: string | null
          concluida_em: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          descricao: string | null
          etapa_id: string | null
          id: string
          obra_id: string | null
          ordem: number
          prazo: string | null
          prioridade: string
          responsavel_colaborador_id: string | null
          responsavel_user_id: string | null
          subetapa_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          coluna_id?: string | null
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          descricao?: string | null
          etapa_id?: string | null
          id?: string
          obra_id?: string | null
          ordem?: number
          prazo?: string | null
          prioridade?: string
          responsavel_colaborador_id?: string | null
          responsavel_user_id?: string | null
          subetapa_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          coluna_id?: string | null
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          descricao?: string | null
          etapa_id?: string | null
          id?: string
          obra_id?: string | null
          ordem?: number
          prazo?: string | null
          prioridade?: string
          responsavel_colaborador_id?: string | null
          responsavel_user_id?: string | null
          subetapa_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "tarefa_colunas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "orcamento_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_colaborador_id_fkey"
            columns: ["responsavel_colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_subetapa_id_fkey"
            columns: ["subetapa_id"]
            isOneToOne: false
            referencedRelation: "orcamento_subetapas"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_from_admin: boolean
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_from_admin?: boolean
          ticket_id: string
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_from_admin?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias: {
        Row: {
          conta_destino_id: string
          conta_origem_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          data: string
          descricao: string | null
          estornada: boolean
          estornada_em: string | null
          estornada_por: string | null
          estorno_token: string
          id: string
          motivo_estorno: string | null
          valor: number
        }
        Insert: {
          conta_destino_id: string
          conta_origem_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          data?: string
          descricao?: string | null
          estornada?: boolean
          estornada_em?: string | null
          estornada_por?: string | null
          estorno_token?: string
          id?: string
          motivo_estorno?: string | null
          valor?: number
        }
        Update: {
          conta_destino_id?: string
          conta_origem_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          data?: string
          descricao?: string | null
          estornada?: boolean
          estornada_em?: string | null
          estornada_por?: string | null
          estorno_token?: string
          id?: string
          motivo_estorno?: string | null
          valor?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          external_id: string | null
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          external_id?: string | null
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          external_id?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
      whatsapp_send_log: {
        Row: {
          created_at: string
          customer_id: string
          error: string | null
          file_name: string | null
          id: string
          message: string | null
          obra_id: string | null
          phone_number: string
          provider: string
          rdo_id: string | null
          response: Json | null
          sent_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          error?: string | null
          file_name?: string | null
          id?: string
          message?: string | null
          obra_id?: string | null
          phone_number: string
          provider?: string
          rdo_id?: string | null
          response?: Json | null
          sent_by?: string | null
          status: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          error?: string | null
          file_name?: string | null
          id?: string
          message?: string | null
          obra_id?: string | null
          phone_number?: string
          provider?: string
          rdo_id?: string | null
          response?: Json | null
          sent_by?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_apply_credit_delta: {
        Args: { _customer_id: string; _delta: number; _motivo: string }
        Returns: {
          saldo: number
        }[]
      }
      calcular_competencia_fatura: {
        Args: {
          p_data_compra: string
          p_dia_fechamento: number
          p_dia_vencimento: number
        }
        Returns: {
          competencia: string
          dt_fechamento: string
          dt_vencimento: string
        }[]
      }
      current_user_customer_id: { Args: never; Returns: string }
      decidir_compra: {
        Args: { _aprovar: boolean; _compra_id: string; _motivo?: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      pode_aprovar_compra: {
        Args: { _customer_id: string; _user_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      user_has_customer_access: {
        Args: { _cust: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "company_owner"
      communication_channel: "email" | "whatsapp"
      communication_status: "queued" | "sent" | "delivered" | "failed"
      communication_trigger:
        | "welcome"
        | "invoice_created"
        | "invoice_reminder"
        | "invoice_overdue"
        | "manual"
      credit_tx_type: "recarga" | "consumo" | "ajuste" | "estorno"
      customer_status: "active" | "inactive" | "overdue" | "canceled"
      invoice_status: "pending" | "paid" | "overdue" | "canceled" | "refunded"
      payment_method:
        | "boleto"
        | "credit_card"
        | "pix"
        | "transfer"
        | "undefined"
      plan_cycle: "monthly" | "quarterly" | "semiannual" | "annual"
      subscription_status: "active" | "paused" | "canceled" | "expired"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "company_owner"],
      communication_channel: ["email", "whatsapp"],
      communication_status: ["queued", "sent", "delivered", "failed"],
      communication_trigger: [
        "welcome",
        "invoice_created",
        "invoice_reminder",
        "invoice_overdue",
        "manual",
      ],
      credit_tx_type: ["recarga", "consumo", "ajuste", "estorno"],
      customer_status: ["active", "inactive", "overdue", "canceled"],
      invoice_status: ["pending", "paid", "overdue", "canceled", "refunded"],
      payment_method: ["boleto", "credit_card", "pix", "transfer", "undefined"],
      plan_cycle: ["monthly", "quarterly", "semiannual", "annual"],
      subscription_status: ["active", "paused", "canceled", "expired"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
      ],
    },
  },
} as const
