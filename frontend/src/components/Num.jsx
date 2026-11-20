// [40] ANIMATED NUMBER - shows a number that rolls to its new value when it changes (uses useCountUp).
import useCountUp from "../hooks/useCountUp";

const Num = ({ value, format = (v) => v.toLocaleString("en-IN"), ms }) => format(useCountUp(Number(value) || 0, ms));

export default Num;
