// Valida params/query/body con esquemas Zod. Las rutas leen solo req.valid, nunca el req crudo.
export function validate(schemas) {
  return (req, res, next) => {
    req.valid = {};
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return res.status(400).json({
          error: 'Datos inválidos',
          detalles: result.error.issues.map((issue) => ({
            campo: [part, ...issue.path].join('.'),
            mensaje: issue.message,
          })),
        });
      }
      req.valid[part] = result.data;
    }
    next();
  };
}
