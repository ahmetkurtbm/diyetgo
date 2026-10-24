import { Router, type Response } from 'express'
import type { Db } from '../db/client'
import { createFoodService } from '../services/foods'
import { createMealTypeService } from '../services/meal-types'
import { archivedBody, includeArchivedParam, ownerOf, stringParam } from './params'

export function foodsRouter(db: Db) {
  const service = (res: Response) => createFoodService(db, ownerOf(res))
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await service(res).list({ search: stringParam(req.query.search), includeArchived: includeArchivedParam(req.query.includeArchived) }))
  })
  // `/:id`'den önce: "ingredients" bir besin kimliği gibi yorumlanmasın.
  router.get('/ingredients', async (_req, res) => {
    res.json(await service(res).listIngredients())
  })
  router.get('/:id', async (req, res) => {
    res.json(await service(res).get(req.params.id))
  })
  router.put('/:id/ingredients', async (req, res) => {
    res.json(await service(res).setIngredients(req.params.id, req.body))
  })
  router.get('/:id/plan-count', async (req, res) => {
    res.json({ count: await service(res).countPlansUsing(req.params.id) })
  })
  router.post('/', async (req, res) => {
    res.status(201).json(await service(res).create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service(res).update(req.params.id, req.body))
  })
  router.put('/:id/archived', async (req, res) => {
    res.json(await service(res).setArchived(req.params.id, archivedBody(req.body)))
  })
  router.delete('/:id', async (req, res) => {
    await service(res).remove(req.params.id)
    res.status(204).end()
  })

  return router
}

export function mealTypesRouter(db: Db) {
  const service = (res: Response) => createMealTypeService(db, ownerOf(res))
  const router = Router()

  router.get('/', async (req, res) => {
    res.json(await service(res).list({ includeArchived: includeArchivedParam(req.query.includeArchived) }))
  })
  router.post('/', async (req, res) => {
    res.status(201).json(await service(res).create(req.body))
  })
  router.put('/:id', async (req, res) => {
    res.json(await service(res).update(req.params.id, req.body))
  })
  router.put('/:id/archived', async (req, res) => {
    res.json(await service(res).setArchived(req.params.id, archivedBody(req.body)))
  })
  router.delete('/:id', async (req, res) => {
    await service(res).remove(req.params.id)
    res.status(204).end()
  })

  return router
}
