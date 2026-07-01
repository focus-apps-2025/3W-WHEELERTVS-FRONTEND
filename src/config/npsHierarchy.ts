export const PRODUCT_NPS_HIERARCHY = {
    "Brakes Related": {
        level2: ["Brake Noise", "Brake Fade", "Brake Lock", "Brake Drag"],
        level3: {
            "Brake Noise": ["Front", "Rear", "Both"],
            "Brake Fade": ["Gradual", "Sudden"],
            "Brake Lock": ["Front", "Rear", "Both"],
            "Brake Drag": ["Continuous", "Intermittent"],
        },
        level4: {
            "Brake Noise": {
                Front: ["Squealing", "Grinding", "Clicking"],
                Rear: ["Squealing", "Grinding", "Clicking"],
                Both: ["Squealing", "Grinding", "Clicking"],
            },
        },
    },
    "Battery Related": {
        level2: ["Battery Drain", "Charging Issue", "Battery Swelling"],
        level3: {
            "Battery Drain": ["Fast Drain", "No Charge Retention"],
            "Charging Issue": ["Not Charging", "Slow Charging"],
            "Battery Swelling": ["Visible Swelling", "Performance Impact"],
        },
        level4: {
            "Battery Drain": {
                "Fast Drain": ["Normal Usage", "Idle Drain"],
                "No Charge Retention": ["Immediate Drain", "Within Hours"],
            },
            "Charging Issue": {
                "Not Charging": ["No Indicator", "Indicator On But Not Charging"],
                "Slow Charging": ["Takes Double Time", "Takes Triple Time"],
            },
        },
        level5: {
            "Battery Drain": {
                "Fast Drain": {
                    "Normal Usage": ["OEM Battery", "Aftermarket Battery"],
                    "Idle Drain": ["OEM Battery", "Aftermarket Battery"],
                },
            },
        },
    },
    "Engine Related": {
        level2: ["Engine Noise", "Oil Leak", "Engine Heat", "Rust"],
        level3: {
            "Engine Noise": ["Knocking", "Rattling", "Whistling"],
            "Oil Leak": ["Minor Leak", "Major Leak"],
            "Engine Heat": ["Overheating", "Running Hot"],
            Rust: ["Surface Rust", "Deep Rust"],
        },
        level4: {
            "Engine Noise": {
                Knocking: ["Idle", "Acceleration", "High Speed"],
                Rattling: ["Idle", "Acceleration", "High Speed"],
                Whistling: ["Idle", "Acceleration", "High Speed"],
            },
            "Engine Heat": {
                Overheating: ["Front", "Rear", "Both Sides"],
                "Running Hot": ["Front", "Rear", "Both Sides"],
            },
        },
        level5: {
            "Engine Noise": {
                Knocking: {
                    Idle: ["0-20 km/h", "20-40 km/h", "40-60 km/h", "60+ km/h"],
                    Acceleration: ["0-20 km/h", "20-40 km/h", "40-60 km/h", "60+ km/h"],
                    "High Speed": ["0-20 km/h", "20-40 km/h", "40-60 km/h", "60+ km/h"],
                },
                Rattling: {
                    Idle: ["0-20 km/h", "20-40 km/h", "40-60 km/h", "60+ km/h"],
                    Acceleration: ["0-20 km/h", "20-40 km/h", "40-60 km/h", "60+ km/h"],
                    "High Speed": ["0-20 km/h", "20-40 km/h", "40-60 km/h", "60+ km/h"],
                },
                Whistling: {
                    Idle: ["0-20 km/h", "20-40 km/h", "40-60 km/h", "60+ km/h"],
                    Acceleration: ["0-20 km/h", "20-40 km/h", "40-60 km/h", "60+ km/h"],
                    "High Speed": ["0-20 km/h", "20-40 km/h", "40-60 km/h", "60+ km/h"],
                },
            },
        },
    },
    "Jerking Related": {
        level2: ["Acceleration Jerk", "Braking Jerk", "Idle Jerk"],
        level3: {
            "Acceleration Jerk": ["Low Speed", "High Speed", "All Speeds"],
            "Braking Jerk": ["Sudden Stop", "Gradual Stop"],
            "Idle Jerk": ["Engine On", "Engine Off"],
        },
    },
    "Part not available": {
        level2: ["Manual Entry Required"],
    },
    "Pick up problem": {
        level2: ["Slow Pickup", "No Pickup", "Intermittent Pickup"],
        level3: {
            "Slow Pickup": ["From Standstill", "While Moving"],
            "No Pickup": ["Complete Failure", "Partial Failure"],
            "Intermittent Pickup": ["Random", "Pattern Based"],
        },
    },
    "Running off": {
        level2: ["Engine Stall", "Power Cut", "Sudden Shutdown"],
        level3: {
            "Engine Stall": ["While Idle", "While Moving"],
            "Power Cut": ["Complete", "Partial"],
            "Sudden Shutdown": ["With Warning", "Without Warning"],
        },
    },
    "Plug issue": {
        level2: ["Manual Entry Required"],
    },
};

export const getLevel1Options = (): string[] => {
    return Object.keys(PRODUCT_NPS_HIERARCHY);
};

export const getLevel2Options = (level1: string): string[] => {
    const category = PRODUCT_NPS_HIERARCHY[level1 as keyof typeof PRODUCT_NPS_HIERARCHY];
    return category?.level2 || [];
};

export const getLevel3Options = (level1: string, level2: string): string[] => {
    const category = PRODUCT_NPS_HIERARCHY[level1 as keyof typeof PRODUCT_NPS_HIERARCHY];
    if (!category?.level3) return [];
    return (category.level3 as any)[level2] || [];
};

export const getLevel4Options = (
    level1: string,
    level2: string,
    level3: string
): string[] => {
    const category = PRODUCT_NPS_HIERARCHY[level1 as keyof typeof PRODUCT_NPS_HIERARCHY];
    if (!category?.level4) return [];
    const level4Data = (category.level4 as any)[level2];
    if (!level4Data) return [];
    return level4Data[level3] || [];
};

export const getLevel5Options = (
    level1: string,
    level2: string,
    level3: string,
    level4: string
): string[] => {
    const category = PRODUCT_NPS_HIERARCHY[level1 as keyof typeof PRODUCT_NPS_HIERARCHY];
    if (!category?.level5) return [];
    const level5Data = (category.level5 as any)[level2];
    if (!level5Data) return [];
    const level5SubData = level5Data[level3];
    if (!level5SubData) return [];
    return level5SubData[level4] || [];
};

export const getLevel6Options = (
    level1: string,
    level2: string,
    level3: string,
    level4: string,
    level5: string
): string[] => {
    const category = PRODUCT_NPS_HIERARCHY[level1 as keyof typeof PRODUCT_NPS_HIERARCHY];
    if (!category?.level6) return [];
    const level6Data = (category.level6 as any)[level2];
    if (!level6Data) return [];
    const level6SubData = level6Data[level3];
    if (!level6SubData) return [];
    const level6SubSubData = level6SubData[level4];
    if (!level6SubSubData) return [];
    return level6SubSubData[level5] || [];
};
