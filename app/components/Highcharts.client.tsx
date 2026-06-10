import Highcharts from "highcharts";
import "highcharts/modules/accessibility";

// Allow rel attribute so <a rel="noopener noreferrer"> renders without warning #33
Highcharts.AST.allowedAttributes.push("rel");
Highcharts.AST.allowedAttributes.push("loading");

export { Highcharts };
export { HighchartsReact } from "highcharts-react-official";
