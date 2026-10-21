import { z } from 'zod';

// Réplica de backend/src/schemas/ordenes.js (crearOrdenBody): mismas reglas, mensajes en español.
// Diferencia deliberada: el email se recorta antes de validar (el backend no lo hace), así
// " ana@example.com " del autocompletado pasa y se envía ya recortado (usar siempre result.data).
export const nombreSchema = z
  .string()
  .trim()
  .min(1, 'Ingresá tu nombre.')
  .max(120, 'El nombre no puede superar los 120 caracteres.');

export const emailSchema = z
  .string()
  .trim()
  .pipe(z.email('Ingresá un email válido.').max(254, 'El email no puede superar los 254 caracteres.'));

export const checkoutSchema = z.object({
  nombre: nombreSchema,
  email: emailSchema,
});

export const crearOrdenSchema = checkoutSchema.extend({
  items: z
    .array(
      z.object({
        productoId: z.number().int().positive(),
        cantidad: z
          .number()
          .int()
          .positive('La cantidad debe ser al menos 1.')
          .max(100, 'Se pueden comprar como máximo 100 unidades por producto.'),
      }),
    )
    .min(1, 'El carrito está vacío.')
    .max(50, 'El carrito puede tener como máximo 50 productos distintos.')
    .refine((items) => new Set(items.map((i) => i.productoId)).size === items.length, {
      message: 'Hay productos repetidos en el carrito.',
    }),
});
