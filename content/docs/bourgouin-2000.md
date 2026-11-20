---
title: A Method to Determine Precipitation Types
authors: Bourgouin, P.
year: 2000
journal: Weather and Forecasting, 15, 583–592
doi: 10.1175/1520-0434(2000)015<0583:AMTDPT>2.0.CO;2
pdf: bourgouin-2000.pdf
---

# A Method to Determine Precipitation Types

**Citation:** Bourgouin, P. (2000), A Method to Determine Precipitation Types. Weather and Forecasting, 15, 583–592.

## In one sentence
The paper introduces the "area method", which diagnoses surface freezing rain, ice pellets, rain and snow from the areas between a temperature profile and the 0°C isotherm on a tephigram, and shows it outperforms the methods then used in Canada.

## Question
Can a predictor taken from the temperature profile alone discriminate among winter precipitation types well enough for routine forecasting? The author argues that a layer's effect on a falling hydrometeor scales with its mean temperature times its depth, an area on an aerological diagram.

## Data and method
- Predictor: the positive area (PA, layer warmer than 0°C) and negative area (NA, layer colder than 0°C), in J kg⁻¹, computed as c_p T̄ ln(θ_top/θ_bottom) (Eq. 2).
- Training sample: North American soundings with precipitation reported within 1 h at the same site, 1989–90 and 1990–91 cold seasons: 54 freezing rain/ice pellet, 119 rain/snow and 3–5 ice pellet/rain cases.
- Independent sample: 1991–92 (29, 42 and 9 cases).
- Criteria from graphical screening and a least-squares line; a perfect-prog approach, so applicable to any NWP model.
- Compared with Derouin (1973), Cantin and Bachand (1993), Ramer (1993) and Baldwin and Contorno (1993).

## Main findings
- Freezing rain vs ice pellets (warm layer aloft, cold layer below): ice pellets if NA > 66 + 0.66 PA, freezing rain if NA < 46 + 0.66 PA, either in between (Eq. 4; a ±10 J kg⁻¹ band around the least-squares line).
- Rain vs snow (surface warm layer only): snow if PA < 5.6 J kg⁻¹, mixed 5.6–13.2, rain if PA > 13.2 J kg⁻¹ (Eq. 5). Below 2 J kg⁻¹ of PA aloft there is no significant melting and Eq. 5 applies.
- Development sample, freezing rain vs ice pellets: area 44/54 (81%), Cantin and Bachand 34/51 (67%), Derouin 20/51 (39%). Rain vs snow: area 80/119 (68%), Cantin and Bachand 36/119 (30%), Derouin 26/119 (22%).
- Independent 1991–92 sample: area 24/29 (83%) vs Derouin 7/29 (24%) for freezing rain/ice pellets; 37/42 (88%) vs 16/42 (38%) for rain/snow.
- Regional Finite Element model 6- and 12-h forecasts, 12–22 January 1995, three Canadian stations (46 cases): area 93%, Baldwin–Contorno 87%, Derouin 85%, Ramer 83%.
- Operational at the Canadian Meteorological Centre since spring 1995; retained with GEM from 1997.

## Why it matters
The method needs only a temperature profile, costs almost no computation, and is not tied to one model or region. The author proposes extending it to icing assessment aloft and to QPF by precipitation type from GEM.

## Figures worth showing
- Fig. 1 (p. 584): schematic profiles with PA and NA shaded for the four profile classes.
- Fig. 2 (p. 587): NA vs PA scatter of freezing rain, ice pellet and mixed reports with the discriminating lines of Eq. 4.
- Fig. 3 (p. 588): freezing level vs PA for 71 rain, snow and mixed cases with the Eq. 5 thresholds; freezing level alone does not separate them.

## Notes for commentary
- Stated simplifications: one hydrometeor size, fall speed and phase; moisture and vertical motion ignored; saturation assumed. Freezing drizzle and mixtures with snow are not diagnosed.
- Samples are small, and the development-sample comparison favours the area method, which was fitted to it.
- Two ice pellet diagnoses verified as snow (NA 605 and 618 J kg⁻¹); the author tentatively proposes snow when NA > 600 J kg⁻¹.
- Cantin and Bachand was designed for subjective forecaster adjustment, so an objective test may understate it; site-specific criteria or discriminant analysis might improve the area method.
