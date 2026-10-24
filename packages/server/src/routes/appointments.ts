import type { AppointmentStatus } from '@diyetgo/shared'
import { Router, type Response } from 'express'
import type { Db } from '../db/client'
import { createAppointmentService } from '../services/appointments'
import { optionalInstant } from '../services/common'
import { ownerOf, stringParam } from './params'

export function appointmentsRouter(db: Db) {
  const service = (res: Response) => createAppointmentService(db, ownerOf(res))
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(
      await service(res).list({
        from: optionalInstant(req.query.from, 'from'),
        to: optionalInstant(req.query.to, 'to'),
        clientId: stringParam(req.query.clientId),
        // Geçerliliği servis doğrular.
        status: stringParam(req.query.status) as AppointmentStatus | undefined,
      }),
    )
  })
  router.post('/', async (req, res) => {
    res.status(201).json(await service(res).create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service(res).update(req.params.id, req.body))
  })
  router.post('/:id/cancel', async (req, res) => {
    res.json(await service(res).cancel(req.params.id))
  })
  router.delete('/:id', async (req, res) => {
    await service(res).remove(req.params.id)
    res.status(204).end()
  })

  return router
}
