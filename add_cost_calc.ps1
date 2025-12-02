$file = "components\CuttingOptimizationPanel.tsx"
$content = Get-Content $file -Raw -Encoding UTF8

# Adicionar o cálculo do custo após a linha com result (linha 460)
# Vou adicionar após a linha do stats (linha 478, antes do zoom slider)

$find = @"
                        </div>

                        {/* Zoom Slider - Positioned above visualization */}
"@

$activeFilmCode = @"
                        </div>

                        {/* Estimated Cost */}
                        {(() => {
                            const film = films.find(f => f.nome === activeFilm);
                            if (!film || !film.precoMetroLinear) return null;
                            const cost = (result.totalHeight / 100) * film.precoMetroLinear;
                            return (
                                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-green-700 dark:text-green-400 uppercase tracking-wider font-medium">Custo Estimado de Material</span>
                                        <span className="font-bold text-green-800 dark:text-green-300 text-lg">R$ {cost.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                    <div className="text-[10px] text-green-600/70 dark:text-green-400/70 mt-1">
                                        {(result.totalHeight / 100).toFixed(2)}m × R$ {film.precoMetroLinear.toFixed(2)}/m
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Zoom Slider - Positioned above visualization */}
"@

$content = $content.Replace($find, $activeFilmCode)
Set-Content -Path $file -Value $content -Encoding UTF8 -NoNewline
Write-Host "Successfully added cost calculation to CuttingOptimizationPanel"
