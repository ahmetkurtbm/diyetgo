/**
 * Danışana bağlı, alt kaydı olmayan kayıtlar: ölçümler, hedefler, ilaçlar, hastalıklar ve öneriler.
 * Listeleme danışan altındadır (`/api/clients/:id/...`).
 */
import { Router, type Response } from 'express'
import type { Db } from '../db/client'
import { createConditionService, createMedicationService, createRecommendationService } from '../services/client-records'
import { createGoalService } from '../services/goals'
import { createMeasurementService } from '../services/measurements'
import { ownerOf } from './params'

export function measurementsRouter(db: Db) {
  const service = (res: Response) => createMeasurementService(db, ownerOf(res))
  const router = Router()

  router.post('/', async (req, res) => {
    res.status(201).json(await service(res).create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service(res).update(req.params.id, req.body))
  })
  router.delete('/:id', async (req, res) => {
    await service(res).remove(req.params.id)
    res.status(204).end()
  })

  return router
}

export function goalsRouter(db: Db) {
  const service = (res: Response) => createGoalService(db, ownerOf(res))
  const router = Router()

  router.post('/', async (req, res) => {
    res.status(201).json(await service(res).create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service(res).update(req.params.id, req.body))
  })
  router.delete('/:id', async (req, res) => {
    await service(res).remove(req.params.id)
    res.status(204).end()
  })

  return router
}

type RecordService = {
  create(input: unknown): Promise<unknown>
  update(id: string, input: unknown): Promise<unknown>
  remove(id: string): Promise<void>
}

/** Oluşturma, güncelleme ve silme uçları; servis her istekte oturum sahibiyle kurulur. */
function recordRouter(service: (res: Response) => RecordService) {
  const router = Router()
  router.post('/', async (req, res) => {
    res.status(201).json(await service(res).create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service(res).update(req.params.id, req.body))
  })
  router.delete('/:id', async (req, res) => {
    await service(res).remove(req.params.id)
    res.status(204).end()
  })
  return router
}

export const medicationsRouter = (db: Db) => recordRouter((res) => createMedicationService(db, ownerOf(res)))
export const conditionsRouter = (db: Db) => recordRouter((res) => createConditionService(db, ownerOf(res)))
export const recommendationsRouter = (db: Db) => recordRouter((res) => createRecommendationService(db, ownerOf(res)))
