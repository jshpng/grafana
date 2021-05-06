import React from 'react';
import uPlot, { AlignedData } from 'uplot';
import {
  DataFrame,
  getFieldColorModeForField,
  getFieldDisplayName,
  getFieldSeriesColor,
  GrafanaTheme2,
  histogramBucketSizes,
} from '@grafana/data';
import { Themeable2 } from '../../types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { UPlotChart } from '../uPlot/Plot';
import { VizLegendOptions } from '../VizLegend/models.gen';
import { VizLayout } from '../VizLayout/VizLayout';
import { withTheme2 } from '../../themes';
import { AxisPlacement, ScaleDirection, ScaleDistribution, ScaleOrientation } from '../uPlot/config';

export interface HistogramProps extends Themeable2 {
  alignedFrame: DataFrame;
  width: number;
  height: number;
  structureRev?: number; // a number that will change when the frames[] structure changes
  legend: VizLegendOptions;
  //onLegendClick?: (event: GraphNGLegendEvent) => void;
  children?: (builder: UPlotConfigBuilder, frame: DataFrame) => React.ReactNode;

  //prepConfig: (frame: DataFrame) => UPlotConfigBuilder;
  //propsToDiff?: string[];
  //renderLegend: (config: UPlotConfigBuilder) => React.ReactElement;
}

const prepConfig = (frame: DataFrame, theme: GrafanaTheme2) => {
  // todo: scan all values in BucketMin and BucketMax fields to assert if uniform bucketSize

  let builder = new UPlotConfigBuilder();

  // assumes BucketMin is fields[0] and BucktMax is fields[1]
  let bucketSize = frame.fields[1].values.get(0) - frame.fields[0].values.get(0);

  // splits shifter, to ensure splits always start at first bucket
  let xSplits: uPlot.Axis.Splits = (u, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace) => {
    /** @ts-ignore */
    let minSpace = u.axes[axisIdx]._space;
    let bucketWidth = u.valToPos(u.data[0][0] + bucketSize, 'x') - u.valToPos(u.data[0][0], 'x');

    let firstSplit = u.data[0][0];
    let lastSplit = u.data[0][u.data[0].length - 1] + bucketSize;

    let splits = [];
    let skip = Math.ceil(minSpace / bucketWidth);

    for (let i = 0, s = firstSplit; s <= lastSplit; i++, s += bucketSize) {
      !(i % skip) && splits.push(s);
    }

    return splits;
  };

  builder.addScale({
    scaleKey: 'x', // bukkits
    isTime: false,
    distribution: ScaleDistribution.Linear,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    range: (u) => [u.data[0][0], u.data[0][u.data[0].length - 1] + bucketSize],
  });

  builder.addScale({
    scaleKey: 'y', // counts
    isTime: false,
    distribution: ScaleDistribution.Linear,
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
  });

  builder.addAxis({
    scaleKey: 'x',
    isTime: false,
    placement: AxisPlacement.Bottom,
    incrs: histogramBucketSizes,
    splits: xSplits,
    //incrs: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((mult) => mult * bucketSize),
    //splits: config.xSplits,
    //values: config.xValues,
    //grid: false,
    //ticks: false,
    //gap: 15,
    theme,
  });

  builder.addAxis({
    scaleKey: 'y',
    isTime: false,
    placement: AxisPlacement.Left,
    //splits: config.xSplits,
    //values: config.xValues,
    //grid: false,
    //ticks: false,
    //gap: 15,
    theme,
  });

  let pathBuilder = uPlot.paths.stepped!({ align: 1 });

  let seriesIndex = 0;

  // assumes BucketMax is [1]
  for (let i = 2; i < frame.fields.length; i++) {
    const field = frame.fields[i];

    field.state!.seriesIndex = seriesIndex++;

    const customConfig = { ...field.config.custom };

    const scaleKey = 'y';
    const colorMode = getFieldColorModeForField(field);
    const scaleColor = getFieldSeriesColor(field, theme);
    const seriesColor = scaleColor.color;

    builder.addSeries({
      scaleKey,
      lineWidth: customConfig.lineWidth,
      lineColor: seriesColor,
      //lineStyle: customConfig.lineStyle,
      fillOpacity: customConfig.fillOpacity,
      theme,
      colorMode,
      pathBuilder,
      //pointsBuilder: config.drawPoints,
      show: !customConfig.hideFrom?.graph,
      gradientMode: customConfig.gradientMode,
      thresholds: field.config.thresholds,

      // The following properties are not used in the uPlot config, but are utilized as transport for legend config
      // dataFrameFieldIndex: {
      //   fieldIndex: i,
      //   frameIndex: 0,
      // },
      fieldName: getFieldDisplayName(field, frame),
      hideInLegend: customConfig.hideFrom?.legend,
    });
  }

  return builder;
};

const preparePlotData = (frame: DataFrame) => {
  let data: AlignedData = [] as any;

  for (const field of frame.fields) {
    if (field.name !== 'BucketMax') {
      data.push(field.values.toArray());
    }
  }

  return data;
};

const renderLegend = (config: UPlotConfigBuilder) => {
  return null;
};

export function sameProps(prevProps: any, nextProps: any, propsToDiff: string[] = []) {
  for (const propName of propsToDiff) {
    if (nextProps[propName] !== prevProps[propName]) {
      return false;
    }
  }

  return true;
}

/**
 * @internal -- not a public API
 */
export interface GraphNGState {
  alignedData: AlignedData;
  config?: UPlotConfigBuilder;
}

class UnthemedHistogram extends React.Component<HistogramProps, GraphNGState> {
  constructor(props: HistogramProps) {
    super(props);
    this.state = this.prepState(props);
  }

  prepState(props: HistogramProps, withConfig = true) {
    let state: GraphNGState = null as any;

    const { alignedFrame } = props;
    if (alignedFrame) {
      state = {
        alignedData: preparePlotData(alignedFrame),
      };

      if (withConfig) {
        state.config = prepConfig(alignedFrame, this.props.theme);
      }
    }

    return state;
  }

  componentDidUpdate(prevProps: HistogramProps) {
    const { structureRev, alignedFrame } = this.props;

    if (alignedFrame !== prevProps.alignedFrame) {
      let newState = this.prepState(this.props, false);

      if (newState) {
        const shouldReconfig =
          this.state.config === undefined || structureRev !== prevProps.structureRev || !structureRev;

        if (shouldReconfig) {
          newState.config = prepConfig(alignedFrame, this.props.theme);
        }
      }

      newState && this.setState(newState);
    }
  }

  render() {
    const { width, height, children, alignedFrame } = this.props;
    const { config } = this.state;

    if (!config) {
      return null;
    }

    return (
      <VizLayout width={width} height={height} legend={renderLegend(config)}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            config={this.state.config!}
            data={this.state.alignedData}
            width={vizWidth}
            height={vizHeight}
            timeRange={null}
          >
            {children ? children(config, alignedFrame) : null}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }
}

export const Histogram = withTheme2(UnthemedHistogram);
Histogram.displayName = 'Histogram';
