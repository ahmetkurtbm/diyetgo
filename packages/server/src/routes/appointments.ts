import type { AppointmentStatus } from '@diyetgo/shared'
import { Router } from 'express'
import type { Db } from '../db/client'
import { createAppointmentService } from '../services/appointments'
import { optionalInstant } from '../services/common'
import { stringParam } from './params'

export function appointmentsRouter(db: Db) {
  const service = createAppointmentService(db)
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(
      await service.list({
        from: optionalInstant(req.query.from, 'from'),
        to: optionalInstant(req.query.to, 'to'),
        clientId: stringParam(req.query.clientId),
        // Geçerliliği servis doğrular.
        status: stringParam(req.query.status) as AppointmentStatus | undefined,
      }),
    )
  })
  router.post('/', async (req, res) => {
    res.status(201).json(await service.create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service.update(req.params.id, req.body))
  })
  router.post('/:id/cancel', async (req, res) => {
    res.json(await service.cancel(req.params.id))
  })
  router.delete('/:id', async (req, res) => {
    await service.remove(req.params.id)
    res.status(204).end()
  })

  return router
}
