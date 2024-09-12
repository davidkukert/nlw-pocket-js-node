import dayjs from 'dayjs'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import { goalCompletions, goals } from '../db/schema'

type GoalsPerDay = Record<
  string,
  {
    id: string
    title: string
    completedAt: string
  }[]
>

export async function getWeekSummary() {
  const firstDayOfTheWeek = dayjs().startOf('week').toDate()
  const lastDayOfTheWeek = dayjs().endOf('week').toDate()

  const goalsCreatedUpToWeek = db.$with('goals_created_up_to_week').as(
    db
      .select({
        id: goals.id,
        title: goals.title,
        desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
        createdAt: goals.createdAt,
      })
      .from(goals)
      .where(lte(goals.createdAt, lastDayOfTheWeek))
  )

  const goalsCompletionInWeek = db.$with('goal_completion_in_week').as(
    db
      .select({
        id: goalCompletions.id,
        title: goals.title,
        completedAt: goalCompletions.createdAt,
        completedAtDate: sql /*sql*/`
          DATE(${goalCompletions.createdAt})
        `.as('completedAtDate'),
      })
      .from(goalCompletions)
      .innerJoin(goals, eq(goals.id, goalCompletions.goalId))
      .where(
        and(
          gte(goalCompletions.createdAt, firstDayOfTheWeek),
          lte(goalCompletions.createdAt, lastDayOfTheWeek)
        )
      )
      .orderBy(desc(goalCompletions.createdAt))
  )

  const goalsCompletedByWeekDay = db.$with('goals_completed_by_week_day').as(
    db
      .select({
        completedAtDate: goalsCompletionInWeek.completedAtDate,
        completions: sql /*sql*/`
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', ${goalsCompletionInWeek.id},
              'title', ${goalsCompletionInWeek.title},
              'completedAt', ${goalsCompletionInWeek.completedAt}
            )
          )
        `.as('completions'),
      })
      .from(goalsCompletionInWeek)
      .groupBy(goalsCompletionInWeek.completedAtDate)
      .orderBy(desc(goalsCompletionInWeek.completedAtDate))
  )

  const summary = await db
    .with(goalsCreatedUpToWeek, goalsCompletionInWeek, goalsCompletedByWeekDay)
    .select({
      completed:
        sql /*sql*/`(SELECT COUNT(*) FROM ${goalsCompletionInWeek})`.mapWith(
          Number
        ),
      total:
        sql /*sql*/`(SELECT SUM(${goalsCreatedUpToWeek.desiredWeeklyFrequency}) FROM ${goalsCreatedUpToWeek})`.mapWith(
          Number
        ),
      goalsPerDay: sql /*sql*/<GoalsPerDay>`
        JSON_OBJECT_AGG(
          ${goalsCompletedByWeekDay.completedAtDate},
          ${goalsCompletedByWeekDay.completions}
        )
      `,
    })
    .from(goalsCompletedByWeekDay)

  return {
    summary: summary[0],
  }
}
