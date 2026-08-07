from typing import List, Dict, Any
import numpy as np

class SpatialGNNPropagation:
    """Stage 2 GNN Model: Network Traffic Propagation over spatial road graph.
    
    Implements spatial graph propagation logic:
      V_neighbor_impact = sum_{j in N(i)} w_{ij} * V_j
    Smooths and propagates congestion bottlenecks across adjacent topological road segments.
    """

    @staticmethod
    def propagate_segment_speeds(
        rf_predicted_speeds: List[float],
        segments: List[Dict[str, Any]],
        alpha: float = 0.3
    ) -> List[float]:
        """Propagates congestion impact across adjacent spatial segments.
        
        Args:
          rf_predicted_speeds: Output speed array from Stage 1 Random Forest.
          segments: List of segment metadata dictionary objects.
          alpha: Spatial graph propagation weighting factor (0.0 to 1.0).
        """
        n = len(rf_predicted_speeds)
        if n <= 1:
            return rf_predicted_speeds

        # Construct spatial adjacency weight matrix W for adjacent segments along the route
        W = np.zeros((n, n))
        for i in range(n):
            if i > 0:
                W[i, i - 1] = 0.5  # Previous segment neighbor
            if i < n - 1:
                W[i, i + 1] = 0.5  # Next segment neighbor

        speeds_arr = np.array(rf_predicted_speeds, dtype=float)

        # Graph convolution: neighbor_impact = W @ speeds_arr
        neighbor_impact = W @ speeds_arr

        # Combine Stage 1 RF prediction with Stage 2 GNN spatial graph propagation
        adjusted_speeds = (1.0 - alpha) * speeds_arr + alpha * neighbor_impact
        return [max(5.0, float(s)) for s in adjusted_speeds]

gnn_engine = SpatialGNNPropagation()
