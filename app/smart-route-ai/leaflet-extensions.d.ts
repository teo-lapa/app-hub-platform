import * as L from 'leaflet';

declare module 'leaflet' {
  namespace Symbol {
    function arrowHead(options: {
      pixelSize: number;
      polygon: boolean;
      pathOptions: {
        stroke: boolean;
        weight: number;
        color: string;
        opacity: number;
      };
    }): any;
  }

  function polylineDecorator(
    polyline: L.Polyline,
    options: {
      patterns: Array<{
        offset: string;
        repeat: number;
        symbol: any;
      }>;
    }
  ): any;
}
