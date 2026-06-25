import { NextResponse } from 'next/server'

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// Convert Prisma model with Date fields to ISO-stringified plain object
export function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function monthRange(month: number, year: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return { start, end }
}

export function nowMonthYear() {
  const d = new Date()
  return { month: d.getMonth() + 1, year: d.getFullYear() }
}

export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}
