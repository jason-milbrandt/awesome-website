---
title: Evaluating the Performance of Planetary Boundary Layer and Cloud Microphysical Parameterization Schemes in Convection-Permitting Ensemble Forecasts Using Synthetic GOES-13 Satellite Observations
authors: Cintineo, R.; Otkin, J. A.; Xue, M.; Kong, F.
year: 2014
journal: Monthly Weather Review, 142, 163-182
doi: 10.1175/MWR-D-13-00143.1
pdf: cintineo-et-al-2014.pdf
---

# Evaluating the Performance of Planetary Boundary Layer and Cloud Microphysical Parameterization Schemes in Convection-Permitting Ensemble Forecasts Using Synthetic GOES-13 Satellite Observations

**Citation:** Cintineo, R., J. A. Otkin, M. Xue, and F. Kong (2014), Evaluating the performance of planetary boundary layer and cloud microphysical parameterization schemes in convection-permitting ensemble forecasts using synthetic GOES-13 satellite observations. Monthly Weather Review, 142, 163-182.

## In one sentence
Comparing synthetic GOES-13 infrared images from 4-km WRF ensemble forecasts with observations over 20 days, the paper finds that Milbrandt–Yau and Morrison produce too much upper-level cloud, WDM6 too little and Thompson the closest to observed, and that the PBL scheme matters much less than the microphysics.

## Question
How accurately do four double-moment microphysics schemes and five PBL schemes in a convection-permitting WRF ensemble simulate cloud cover over the contiguous United States, judged against satellite infrared brightness temperatures?

## Data and method
- Eight members of the CAPS 4-km WRF ensemble (2012 NOAA Hazardous Weather Testbed Spring Experiment), identical except for physics. Microphysics (all with MYJ PBL): Milbrandt–Yau (M–Y, double-moment for all species), Morrison (MORR), WDM6 (double-moment warm rain only), Thompson (THOM, double-moment ice and rain). PBL (all with Thompson): MYJ, QNSE, MYNN (local), YSU, ACM2 (nonlocal).
- 20 forecasts, 15 May–8 June 2012, 36 h from 0000 UTC; first 6 h excluded.
- The SOI radiative transfer model gives synthetic 6.7-µm (water vapour) and 10.7-µm (window) brightness temperatures (BT).
- Scores: BT frequency distributions, 6.7–10.7-µm BT difference (BTD) area ratios for low-mid (−30 to −10 K), upper (−10 to 0 K) and overshooting-top (> −2 K) cloud, bias/RMSE/MAE, and fractions skill score (FSS) at 270 K and 240 K.

## Main findings
- All members have a mid- to upper-tropospheric moist bias (too many 6.7-µm BTs at 230–240 K, too few at 250–260 K), attributed to the initial conditions.
- Upper-level cloud area: M–Y overestimates by nearly a factor of 2, MORR by nearly 50 %, WDM6 underestimates by about 40 %; THOM stays close to 1:1.
- Every member underforecasts low- to mid-level cloud; MORR is closest, then M–Y; ACM2 is the best PBL scheme here.
- Overshooting-top area is overforecast by all members except WDM6 at peak convection, peaking 3–5 h early; M–Y overpredicts at all hours.
- M–Y and MORR have the largest cold bias, RMSE and MAE, WDM6 and THOM the smallest. FSS at 240 K ranks THOM best and WDM6 worst.
- PBL: MYJ and QNSE give too many evening cold pixels and the largest daytime surface cold bias; MYNN handles surface heating best. ACM2, YSU and MYNN generally do best.

## Why it matters
The authors conclude that Thompson, though less complex than M–Y and MORR, gave the most accurate cloud forecasts, and that the spread between schemes shows large remaining uncertainty in subgrid cloud processes. Because rankings changed with the verification method, they argue for a suite of metrics.

## Figures worth showing
- Fig. 3 (journal p. 168, PDF p. 6): observed and simulated 10.7-µm BT, all members, 0400 UTC 7 June 2012.
- Fig. 7 (journal p. 174, PDF p. 12): forecast-to-observed cloud area ratios by layer vs forecast hour.
- Fig. 12 (journal p. 179, PDF p. 17): FSS vs neighbourhood size, 240-K threshold.

## Notes for commentary
- WDM6's low RMSE/MAE reflects less "double penalty" from fewer clouds, not better clouds (authors).
- The top-down view hides low cloud beneath excess upper cloud in M–Y and MORR.
- The authors suggest, without testing, that the 10 cm⁻³ ice-number cap in M–Y and MORR (0.25 cm⁻³ in Thompson) causes some of the excess upper cloud.
- PBL schemes were tested only with Thompson; results cover cloud, not precipitation; thunderstorm activity was below normal.
