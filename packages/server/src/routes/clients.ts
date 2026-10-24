import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../db/client'
import { parse } from '../errors'
import { createClientService } from '../services/clients'

const archivedBodySchema = z.object({ archived: z.boolean() })

export function clientsRouter(db: Db) {
  const service = createClientService(db)
  const router = Router()

  router.get('/', async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    res.json(await service.list({ search, includeArchived: req.query.includeArchived === 'true' }))
  })
  router.get('/:id', async (req, res) => {
    res.json(await service.get(req.params.id))
  })
  router.post('/', async (req, res) => {
    res.status(201).json(await service.create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service.update(req.params.id, req.body))
  })
  router.put('/:id/archived', async (req, res) => {
    const { archived } = parse(archivedBodySchema, req.body)
    res.json(await service.setArchived(req.params.id, archived))
  })
  router.delete('/:id', async (req, res) => {
    await service.remove(req.params.id)
    res.status(204).end()
  })

  return router
}
