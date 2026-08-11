// Outstanding balance is never stored as its own row — it's always
// (program price) minus (sum of paid payments) for a given client+program.
// This keeps "how much do they still owe" honest and live, instead of
// depending on someone remembering to create a matching "pending" record.
export function computeProgramBalances(payments, programs) {
  const programById = Object.fromEntries(programs.map((p) => [p.id, p]))
  const groups = {}

  for (const p of payments) {
    if (!p.program_id) continue
    const key = `${p.client_id}__${p.program_id}`
    if (!groups[key]) {
      groups[key] = { clientId: p.client_id, programId: p.program_id, paid: 0, lastDueDate: null }
    }
    if (p.status === 'paid') {
      groups[key].paid += Number(p.amount)
    }
    if (p.due_date && (!groups[key].lastDueDate || p.due_date > groups[key].lastDueDate)) {
      groups[key].lastDueDate = p.due_date
    }
  }

  const now = new Date()

  return Object.values(groups)
    .map((g) => {
      const program = programById[g.programId]
      const price = program ? Number(program.price) : 0
      const balance = Math.max(price - g.paid, 0)
      const isOverdue = balance > 0 && g.lastDueDate && new Date(g.lastDueDate) < now
      return {
        clientId: g.clientId,
        programId: g.programId,
        programName: program?.name ?? 'Unknown program',
        price,
        paid: g.paid,
        balance,
        dueDate: g.lastDueDate,
        isOverdue,
      }
    })
    .filter((g) => g.balance > 0)
}
