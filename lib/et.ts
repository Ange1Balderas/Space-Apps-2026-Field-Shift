// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Reference evapotranspiration (ET0): the water a well-watered grass surface would use in a
// day, worked out from weather alone. Method: FAO-56 Penman-Monteith (Allen, Pereira, Raes
// and Smith, 1998, FAO Irrigation and Drainage Paper 56). Everything here is metric.
//   Chapter 3, the equations for the weather terms: https://www.fao.org/4/X0490E/x0490e07.htm
//   Chapter 4, Equation 6 and the daily worked example: https://www.fao.org/4/X0490E/x0490e08.htm
// Equation numbers in the comments are FAO-56's. lib/et.test.ts reproduces the worked example.

import { type DailyWeather, dayOfYear } from "@/lib/indicators";

/** Saturation vapour pressure at an air temperature, in kPa (Eq. 11). */
export function saturationVapourPressureKpa(tempC: number): number {
	return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

/** Slope of the saturation vapour pressure curve at an air temperature, in kPa per °C (Eq. 13). */
export function vapourPressureSlope(tempC: number): number {
	return (4098 * saturationVapourPressureKpa(tempC)) / (tempC + 237.3) ** 2;
}

/** Atmospheric pressure at an elevation above sea level, in kPa (Eq. 7). */
export function atmosphericPressureKpa(elevationM: number): number {
	return 101.3 * ((293 - 0.0065 * elevationM) / 293) ** 5.26;
}

/** Psychrometric constant for an atmospheric pressure, in kPa per °C (Eq. 8). */
export function psychrometricConstant(pressureKpa: number): number {
	return 0.000665 * pressureKpa;
}

/** Actual vapour pressure from the dew point, in kPa (Eq. 14). FAO-56's preferred source. */
export function vapourPressureFromDewPointKpa(dewPointC: number): number {
	return saturationVapourPressureKpa(dewPointC);
}

/**
 * Actual vapour pressure from the day's mean relative humidity, in kPa (Eq. 19). FAO-56
 * calls this less desirable than the dew point; it is the fallback when there is none.
 */
export function vapourPressureFromMeanHumidityKpa(
	meanHumidityPct: number,
	tmaxC: number,
	tminC: number,
): number {
	return (meanHumidityPct / 100) * meanSaturationVapourPressureKpa(tmaxC, tminC);
}

/** Mean saturation vapour pressure for a day, in kPa (Eq. 12). */
export function meanSaturationVapourPressureKpa(
	tmaxC: number,
	tminC: number,
): number {
	return (
		(saturationVapourPressureKpa(tmaxC) + saturationVapourPressureKpa(tminC)) / 2
	);
}

/**
 * Extraterrestrial radiation: the sunlight reaching the top of the atmosphere over a point
 * on one day, in MJ per square metre per day (Eqs. 21 and 23 to 25). North latitudes are positive.
 */
export function extraterrestrialRadiationMj(
	latitudeDeg: number,
	dayNumber: number,
): number {
	const latitude = (latitudeDeg * Math.PI) / 180;
	const yearAngle = (2 * Math.PI * dayNumber) / 365;
	const inverseDistance = 1 + 0.033 * Math.cos(yearAngle);
	const declination = 0.409 * Math.sin(yearAngle - 1.39);
	// Beyond the polar circles the sun can stay up or down all day; the clamp keeps acos defined.
	const sunsetAngle = Math.acos(
		Math.min(1, Math.max(-1, -Math.tan(latitude) * Math.tan(declination))),
	);
	return (
		((24 * 60) / Math.PI) *
		0.082 *
		inverseDistance *
		(sunsetAngle * Math.sin(latitude) * Math.sin(declination) +
			Math.cos(latitude) * Math.cos(declination) * Math.sin(sunsetAngle))
	);
}

/** Solar radiation on a cloudless day, in MJ per square metre per day (Eq. 37). */
export function clearSkyRadiationMj(
	extraterrestrialMj: number,
	elevationM: number,
): number {
	return (0.75 + 2e-5 * elevationM) * extraterrestrialMj;
}

/** The share of sunlight a grass reference surface reflects (FAO-56, Eq. 38). */
const ALBEDO = 0.23;
/** Stefan-Boltzmann constant, in MJ per K⁴ per square metre per day (FAO-56, Eq. 39). */
const STEFAN_BOLTZMANN = 4.903e-9;

/**
 * Net radiation at the crop surface, in MJ per square metre per day: the sunlight absorbed
 * (Eq. 38) less the heat radiated back to the sky (Eq. 39). Eq. 40.
 */
export function netRadiationMj(input: {
	solarMj: number;
	clearSkyMj: number;
	tmaxC: number;
	tminC: number;
	vapourPressureKpa: number;
}): { netShortwaveMj: number; netLongwaveMj: number; netMj: number } {
	const netShortwaveMj = (1 - ALBEDO) * input.solarMj;
	const tmaxK = input.tmaxC + 273.16;
	const tminK = input.tminC + 273.16;
	// Measured sunlight as a share of the clear-sky amount. FAO-56 limits it to 1.
	const relativeSolar = Math.min(1, input.solarMj / input.clearSkyMj);
	const netLongwaveMj =
		STEFAN_BOLTZMANN *
		((tmaxK ** 4 + tminK ** 4) / 2) *
		(0.34 - 0.14 * Math.sqrt(input.vapourPressureKpa)) *
		(1.35 * relativeSolar - 0.35);
	return {
		netShortwaveMj,
		netLongwaveMj,
		netMj: netShortwaveMj - netLongwaveMj,
	};
}

/**
 * Reference evapotranspiration for one day, in mm (Eq. 6). The soil heat flux is taken as
 * zero, as FAO-56 does for a period of one day (Eq. 42).
 */
export function penmanMonteithEt0Mm(input: {
	tmaxC: number;
	tminC: number;
	windMs: number;
	netRadiationMj: number;
	vapourPressureKpa: number;
	elevationM: number;
}): number {
	const meanC = (input.tmaxC + input.tminC) / 2;
	const slope = vapourPressureSlope(meanC);
	const gamma = psychrometricConstant(atmosphericPressureKpa(input.elevationM));
	const deficit =
		meanSaturationVapourPressureKpa(input.tmaxC, input.tminC) -
		input.vapourPressureKpa;
	return (
		(0.408 * slope * input.netRadiationMj +
			gamma * (900 / (meanC + 273)) * input.windMs * deficit) /
		(slope + gamma * (1 + 0.34 * input.windMs))
	);
}

const present = (value: number | null | undefined): value is number =>
	typeof value === "number" && Number.isFinite(value);

/**
 * Reference evapotranspiration for one day of NASA POWER weather at a site, in mm, or null
 * when an input is missing. Vapour pressure comes from the dew point, with the mean
 * relative humidity as the fallback (SPEC.md, "Formulas", item 1). Nothing is estimated to
 * fill a gap: a day with no sunlight value has no reference ET.
 */
export function dailyEt0Mm(
	day: DailyWeather,
	site: { latitudeDeg: number; elevationM: number },
): number | null {
	const { tmaxC, tminC, solarMj, windMs, dewC, rhPct } = day;
	if (
		!present(tmaxC) ||
		!present(tminC) ||
		!present(solarMj) ||
		!present(windMs)
	) {
		return null;
	}
	let vapourPressureKpa: number;
	if (present(dewC)) {
		vapourPressureKpa = vapourPressureFromDewPointKpa(dewC);
	} else if (present(rhPct)) {
		vapourPressureKpa = vapourPressureFromMeanHumidityKpa(rhPct, tmaxC, tminC);
	} else {
		return null;
	}
	const clearSkyMj = clearSkyRadiationMj(
		extraterrestrialRadiationMj(site.latitudeDeg, dayOfYear(day.date)),
		site.elevationM,
	);
	if (!(clearSkyMj > 0)) return null;
	const { netMj } = netRadiationMj({
		solarMj,
		clearSkyMj,
		tmaxC,
		tminC,
		vapourPressureKpa,
	});
	return penmanMonteithEt0Mm({
		tmaxC,
		tminC,
		windMs,
		netRadiationMj: netMj,
		vapourPressureKpa,
		elevationM: site.elevationM,
	});
}
