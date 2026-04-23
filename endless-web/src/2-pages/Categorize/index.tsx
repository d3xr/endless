import React, { useMemo, useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Chip,
  Paper,
  Stack,
  Button,
  LinearProgress,
  Alert,
  Divider,
} from '@mui/material'
import { useAppDispatch } from 'store'
import { trModel } from '5-entities/transaction'
import { tagModel } from '5-entities/tag'
import { accountModel } from '5-entities/account'
import { formatMoney } from '6-shared/helpers/money'
import type { TTransaction, TTagId } from '6-shared/types/data-entities'

// Quick-assign tags for unknown transactions (most common for card expenses)
const QUICK_TAGS = [
  'Покупка еды',
  'Кафе и рестораны',
  'Непродовольственные товары',
  'Переводы',
  'Подарки',
  'Развлечения',
  'Дом',
  'Авто',
  'Здоровье и фитнес',
  'Одеждах',
  'Дети',
  'Техника',
  'Уход за собой',
]

export default function CategorizePage() {
  const dispatch = useAppDispatch()
  const allTransactions = trModel.useTransactionsHistory()
  const tags = tagModel.usePopulatedTags()
  const accounts = accountModel.usePopulatedAccounts()
  const [done, setDone] = useState<Set<string>>(new Set())

  const uncategorized = useMemo(
    () =>
      allTransactions
        .filter(tx => {
          if (tx.tag && tx.tag.length > 0) return false
          if (tx.income > 0 && tx.outcome > 0) return false
          if (done.has(tx.id)) return false
          return true
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allTransactions, done]
  )

  // Resolve tag ID by display name (exact or parent>child match)
  const tagByName = useMemo(() => {
    const m = new Map<string, TTagId>()
    for (const [id, t] of Object.entries(tags)) {
      m.set(t.name.trim().toLowerCase(), id)
      if (t.uniqueName) m.set(t.uniqueName.trim().toLowerCase(), id)
    }
    return m
  }, [tags])

  const assignTag = useCallback(
    (txIds: string[], tagName: string) => {
      const tagId = tagByName.get(tagName.toLowerCase())
      if (!tagId) return
      dispatch(trModel.bulkEditTransactions(txIds, { tags: [tagId] }))
      setDone(prev => {
        const next = new Set(prev)
        txIds.forEach(id => next.add(id))
        return next
      })
    },
    [dispatch, tagByName]
  )

  const skipTx = useCallback(
    (txIds: string[]) => {
      // Assign "Непродовольственные товары" as catch-all
      const tagId = tagByName.get('непродовольственные товары')
      if (tagId) {
        dispatch(trModel.bulkEditTransactions(txIds, { tags: [tagId] }))
      }
      setDone(prev => {
        const next = new Set(prev)
        txIds.forEach(id => next.add(id))
        return next
      })
    },
    [dispatch, tagByName]
  )

  if (uncategorized.length === 0) {
    return (
      <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
        <Alert severity="success" sx={{ fontSize: '1.1rem' }}>
          Все транзакции категоризированы!
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
        Категоризация
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {uncategorized.length} транзакций без категории. Нажми на категорию
        чтобы присвоить, или «Не помню» чтобы пропустить.
      </Typography>
      <LinearProgress
        variant="determinate"
        value={(done.size / (done.size + uncategorized.length)) * 100}
        sx={{ mb: 3, height: 6, borderRadius: 3 }}
      />

      <Stack spacing={2}>
        {uncategorized.map(tx => (
          <TxCard
            key={tx.id}
            tx={tx}
            account={accounts[tx.outcome > 0 ? tx.outcomeAccount : tx.incomeAccount]}
            onAssign={tagName => assignTag([tx.id], tagName)}
            onSkip={() => skipTx([tx.id])}
          />
        ))}
      </Stack>
    </Box>
  )
}

function TxCard({
  tx,
  account,
  onAssign,
  onSkip,
}: {
  tx: TTransaction
  account: any
  onAssign: (tagName: string) => void
  onSkip: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isExpense = tx.outcome > 0
  const amount = isExpense ? tx.outcome : tx.income
  const accName = account?.title || '?'
  const payee = tx.payee || tx.comment || null

  const dateStr = new Date(tx.date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'short',
  })

  return (
    <Paper sx={{ p: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 1,
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {payee || 'Без описания'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {dateStr} · {accName}
          </Typography>
          {tx.mcc && (
            <Typography variant="caption" color="text.secondary">
              MCC: {tx.mcc}
            </Typography>
          )}
        </Box>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: isExpense ? 'error.main' : 'success.main',
            fontFeatureSettings: '"tnum"',
          }}
        >
          {isExpense ? '−' : '+'}
          {formatMoney(amount, undefined, 0)}
        </Typography>
      </Box>

      {!payee && (
        <Typography
          variant="caption"
          color="warning.main"
          sx={{ display: 'block', mb: 1 }}
        >
          ⚠ Нет получателя, комментария и MCC — невозможно определить автоматически.
          Помнишь что это было?
        </Typography>
      )}

      {/* Quick tags */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
        {(expanded ? QUICK_TAGS : QUICK_TAGS.slice(0, 6)).map(name => (
          <Chip
            key={name}
            label={name}
            size="small"
            variant="outlined"
            onClick={() => onAssign(name)}
            sx={{
              cursor: 'pointer',
              '&:hover': { bgcolor: 'primary.main', color: 'white' },
            }}
          />
        ))}
        {!expanded && (
          <Chip
            label={`ещё ${QUICK_TAGS.length - 6}...`}
            size="small"
            onClick={() => setExpanded(true)}
            sx={{ cursor: 'pointer', opacity: 0.6 }}
          />
        )}
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Button
        size="small"
        color="inherit"
        onClick={onSkip}
        sx={{ textTransform: 'none', opacity: 0.6 }}
      >
        Не помню → пропустить (Непрод. товары)
      </Button>
    </Paper>
  )
}
