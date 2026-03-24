import { matchFilmFromExtractedText } from './filmMatchingService';
import { Film } from '../types';

describe('filmMatchingService', () => {
  const films: Film[] = [
    { nome: 'Blackout', preco: 100 },
    {
      nome: 'Fume Espelhado',
      preco: 120,
      customFields: {
        __match_brand: '3M',
        __match_aliases: 'espelhado, fume mirror'
      }
    },
    { nome: 'Carbono', preco: 90 }
  ];

  it('retorna match exato quando o nome detectado bate com a pelicula cadastrada', () => {
    const result = matchFilmFromExtractedText('Blackout', films);

    expect(result.matchedFilmName).toBe('Blackout');
    expect(result.confidence).toBe(1);
    expect(result.alternatives[0].reason).toBe('exact_name');
  });

  it('reconhece variacoes simples de espacamento e acentuacao', () => {
    const result = matchFilmFromExtractedText('Fumê   espelhado', films);

    expect(result.matchedFilmName).toBe('Fume Espelhado');
    expect(result.confidence).toBeGreaterThanOrEqual(0.97);
  });

  it('retorna alternativas sem forcar match forte em texto parcial demais', () => {
    const result = matchFilmFromExtractedText('espelhado', films);

    expect(result.matchedFilmName).toBe('Fume Espelhado');
    expect(result.confidence).toBeLessThan(0.85);
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it('usa alias cadastrado para reconhecer pelicula com nome alternativo', () => {
    const result = matchFilmFromExtractedText('fume mirror', films);

    expect(result.matchedFilmName).toBe('Fume Espelhado');
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('usa marca cadastrada para fortalecer sugestao quando o texto extraido inclui a marca', () => {
    const result = matchFilmFromExtractedText('3M espelhado', films);

    expect(result.matchedFilmName).toBe('Fume Espelhado');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('nao tenta vincular quando o usuario nao tem peliculas cadastradas', () => {
    const result = matchFilmFromExtractedText('Blackout', []);

    expect(result.matchedFilmName).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.alternatives).toEqual([]);
  });
});
