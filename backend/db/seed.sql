SET NAMES utf8mb4;

INSERT INTO categorias (id, nombre, slug) VALUES
  (1, 'Tereré', 'terere'),
  (2, 'Mates', 'mates'),
  (3, 'Yerba', 'yerba'),
  (4, 'Accesorios', 'accesorios');

INSERT INTO productos (categoria_id, nombre, descripcion, precio, stock) VALUES
  (1, 'Kit tereré completo', 'Termo de 1 L, guampa de cuerno, bombilla y yerba de 500 g. Listo para el primer tereré.', 285000, 8),
  (1, 'Jarra térmica para tereré 2 L', 'Mantiene el agua helada toda la tarde. Pico vertedor y manija reforzada.', 95000, 15),
  (1, 'Yuyos frescos para tereré', 'Mezcla de menta’i, cedrón y burrito para machacar en el mortero.', 12000, 40),
  (1, 'Mortero de madera para yuyos', 'Mortero de lapacho con mazo, para machacar los yuyos del tereré.', 65000, 0),
  (2, 'Guampa de cuerno con virola', 'Guampa tradicional de cuerno vacuno con virola de alpaca grabada.', 120000, 10),
  (2, 'Mate de palo santo', 'Tallado a mano en palo santo del Chaco, con su aroma característico.', 75000, 12),
  (2, 'Mate de calabaza forrado en cuero', 'Calabaza curada y forrada en cuero crudo con costura artesanal.', 85000, 9),
  (2, 'Guampa de madera para tereré', 'Guampa liviana de madera barnizada, ideal para el tereré diario.', 45000, 25),
  (3, 'Yerba mate tradicional 1 kg', 'Molienda gruesa con palo, sabor intenso. Para mate y tereré.', 32000, 50),
  (3, 'Yerba con menta y boldo 500 g', 'Compuesta con menta y boldo, refrescante para el tereré.', 18000, 60),
  (3, 'Yerba con burrito y cedrón 500 g', 'Compuesta con hierbas digestivas, suave y aromática.', 18500, 45),
  (3, 'Yerba despalada suave 500 g', 'Sin palo, sabor suave. Ideal para quienes se inician en el mate.', 16000, 35),
  (4, 'Termo de acero 1 L', 'Doble pared de acero inoxidable, pico cebador. Mantiene el frío 24 h.', 165000, 14),
  (4, 'Bombilla de alpaca', 'Bombilla de alpaca con filtro desmontable, fácil de limpiar.', 55000, 30),
  (4, 'Matera de cuero', 'Bolso de cuero con compartimentos para termo, guampa y yerbera.', 210000, 6),
  (4, 'Yerbera y azucarera de cuero', 'Set de dos recipientes de cuero con tapa a rosca.', 70000, 18);
