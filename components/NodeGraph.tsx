
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Agent, ProjectState } from '../types';

interface NodeGraphProps {
  project: ProjectState;
  onSelectAgent: (id: string) => void;
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  role: string;
  color: string;
  icon: string;
  isOrchestrator?: boolean;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string;
  target: string;
}

const NodeGraph: React.FC<NodeGraphProps> = ({ project, onSelectAgent }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        setDimensions({
          width: svgRef.current.parentElement.clientWidth,
          height: svgRef.current.parentElement.clientHeight,
        });
      }
    };
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || project.agents.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const nodes: Node[] = [
      { id: 'master', name: 'Orchestrator', role: 'Main Intelligence', color: '#ffffff', icon: 'brain', isOrchestrator: true },
      ...project.agents.map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        color: a.color,
        icon: a.icon,
      }))
    ];

    const links: Link[] = project.agents.map(a => ({
      source: 'master',
      target: a.id
    }));

    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(180))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collision", d3.forceCollide().radius(60));

    const link = svg.append("g")
      .attr("stroke", "rgba(99, 102, 241, 0.2)")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5);

    const node = svg.append("g")
      .selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        if (!d.isOrchestrator) onSelectAgent(d.id);
      })
      .call(d3.drag<any, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Outer circles
    node.append("circle")
      .attr("r", d => d.isOrchestrator ? 40 : 30)
      .attr("fill", "#0f172a")
      .attr("stroke", d => d.color)
      .attr("stroke-width", 2)
      .attr("class", "glow-node");

    // Icons
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-family", "FontAwesome")
      .attr("fill", d => d.color)
      .attr("font-size", d => d.isOrchestrator ? "24px" : "18px")
      .text(d => {
        // Simple map for common icons as we use FontAwesome CSS
        return "\uf0e8"; // Default placeholder
      });

    // We use a foreignObject for actual font awesome rendering for better aesthetics
    node.append("foreignObject")
      .attr("x", d => d.isOrchestrator ? -15 : -12)
      .attr("y", d => d.isOrchestrator ? -15 : -12)
      .attr("width", d => d.isOrchestrator ? 30 : 24)
      .attr("height", d => d.isOrchestrator ? 30 : 24)
      .append("xhtml:i")
      .attr("class", d => `fa-solid fa-${d.icon} text-center w-full`)
      .attr("style", d => `color: ${d.color}; font-size: ${d.isOrchestrator ? '28px' : '20px'};`);

    // Labels
    node.append("text")
      .attr("dy", d => d.isOrchestrator ? 60 : 50)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .attr("font-size", "12px")
      .attr("font-weight", "500")
      .text(d => d.name);

    node.append("text")
      .attr("dy", d => d.isOrchestrator ? 75 : 65)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", "10px")
      .text(d => d.role);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [project.agents, dimensions]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-900/50 rounded-2xl border border-slate-800">
      <svg ref={svgRef} className="w-full h-full" />
      {project.isOrchestrating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="text-center p-8 glass-panel rounded-2xl">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-xl font-bold mb-2">Orchestrating Team...</h3>
            <p className="text-slate-400">Scanning vibe and spawning nodes</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeGraph;
