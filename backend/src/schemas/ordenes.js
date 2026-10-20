import { z } from 'zod';

export const crearOrdenBody = z.object({
  nombre: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  items: z
    .array(
      z.object({
        productoId: z.number().int().positive(),
        cantidad: z.number().int().positive().max(100),
      }),
    )
    .min(1)
    .max(50)
    .refine((items) => new Set(items.map((i) => i.productoId)).size === items.length, {
      message: 'Hay productos repetidos; sumá las cantidades en un solo ítem',
    }),
});
