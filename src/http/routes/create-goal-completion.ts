import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import z from 'zod'
import { createGoalCompletion } from '../../functions/create-goal-completion'

export const createGoalCompletionRoute: FastifyPluginAsyncZod = async app => {
  app.post(
    '/goals/completion',
    {
      schema: {
        body: z.object({
          goalId: z.string(),
        }),
      },
    },
    async request => {
      const { goalId } = request.body

      await createGoalCompletion({ goalId })
    }
  )
}
