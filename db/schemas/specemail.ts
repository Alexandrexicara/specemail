import { pgTable, serial, varchar, boolean, timestamp, text, integer } from 'drizzle-orm/pg-core'

export const configuracoes = pgTable('configuracoes', {
  id: serial('id').primaryKey(),
  nomeEmpresa: varchar('nome_empresa', { length: 100 }).notNull().default('Minha Empresa'),
  site: varchar('site', { length: 255 }).default(''),
  whatsapp: varchar('whatsapp', { length: 20 }).default(''),
  instagram: varchar('instagram', { length: 100 }).default(''),
  facebook: varchar('facebook', { length: 100 }).default(''),
  emailContato: varchar('email_contato', { length: 100 }).default(''),
  criadoEm: timestamp('criado_em').defaultNow(),
  atualizadoEm: timestamp('atualizado_em').defaultNow(),
})

export const emails = pgTable('emails', {
  id: serial('id').primaryKey(),
  nome: varchar('nome', { length: 100 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  senha: varchar('senha', { length: 255 }).notNull(),
  cargo: varchar('cargo', { length: 50 }).default(''),
  cpf: varchar('cpf', { length: 14 }).default(''),
  ativo: boolean('ativo').default(true),
  // pagamento: 'pendente' | 'pago' | 'cancelado'
  statusPagamento: varchar('status_pagamento', { length: 20 }).default('pendente'),
  pagbankOrderId: varchar('pagbank_order_id', { length: 100 }).default(''),
  pagbankChargeId: varchar('pagbank_charge_id', { length: 100 }).default(''),
  criadoEm: timestamp('criado_em').defaultNow(),
})

// Sessões de login
export const sessoes = pgTable('sessoes', {
  id: serial('id').primaryKey(),
  emailId: integer('email_id').notNull(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  criadoEm: timestamp('criado_em').defaultNow(),
  expiraEm: timestamp('expira_em').notNull(),
})

// Mensagens internas
export const mensagens = pgTable('mensagens', {
  id: serial('id').primaryKey(),
  deEmailId: integer('de_email_id').notNull(),
  deEmail: varchar('de_email', { length: 100 }).notNull(),
  deNome: varchar('de_nome', { length: 100 }).notNull(),
  paraEmail: varchar('para_email', { length: 100 }).notNull(),
  assunto: varchar('assunto', { length: 255 }).notNull().default('(Sem assunto)'),
  corpo: text('corpo').notNull().default(''),
  // JSON array de { nome, tipo, tamanho, base64 }
  anexos: text('anexos').default('[]'),
  lida: boolean('lida').default(false),
  pasta: varchar('pasta', { length: 20 }).default('entrada'),
  criadoEm: timestamp('criado_em').defaultNow(),
})
