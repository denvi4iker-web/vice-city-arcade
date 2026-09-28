(() => {
  'use strict';
  // Earliest intersection along a segment, including a segment beginning inside a wall.
  function segmentRect(a,b,r,pad=0){
    let low=0,high=1;
    for(const [origin,delta,min,max] of [[a.x,b.x-a.x,r.x-pad,r.x+r.w+pad],[a.y,b.y-a.y,r.y-pad,r.y+r.h+pad]]){
      if(Math.abs(delta)<1e-9){if(origin<min||origin>max)return null;continue}
      let u=(min-origin)/delta,v=(max-origin)/delta;if(u>v)[u,v]=[v,u];low=Math.max(low,u);high=Math.min(high,v);if(low>high)return null;
    }
    return low;
  }
  function segmentCircle(a,b,c,r){
    const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-c.x,oy=a.y-c.y,A=dx*dx+dy*dy,C=ox*ox+oy*oy-r*r;
    if(C<=0)return 0;if(A<1e-9)return null;const B=2*(ox*dx+oy*dy),D=B*B-4*A*C;if(D<0)return null;const t=(-B-Math.sqrt(D))/(2*A);return t>=0&&t<=1?t:null;
  }
  const clear=(a,b,walls,pad=0)=>!walls.some(r=>segmentRect(a,b,r,pad)!==null);
  function path(a,b,walls,blocked){
    const cols=35,rows=20,point=i=>({x:25+i%cols*25,y:35+Math.floor(i/cols)*25});
    const near=(p,from)=>{let id=-1,d=Infinity;for(let i=0;i<cols*rows;i++){const q=point(i),v=Math.hypot(p.x-q.x,p.y-q.y);if(v<d&&!blocked(q.x,q.y)&&(!from||clear(p,q,walls,13))){id=i;d=v}}return id};
    const start=near(a,true),end=near(b,false);if(start<0||end<0)return [];
    const prev=new Int32Array(cols*rows).fill(-1),queue=[start];prev[start]=start;
    for(let k=0;k<queue.length&&prev[end]<0;k++){const i=queue[k];for(const j of [i-cols,i+cols,i%cols?i-1:-1,i%cols<cols-1?i+1:-1]){if(j<0||j>=cols*rows||prev[j]>=0)continue;const q=point(j);if(blocked(q.x,q.y)||!clear(point(i),q,walls,13))continue;prev[j]=i;queue.push(j)}}
    if(prev[end]<0)return [];const out=[];for(let i=end;i!==start;i=prev[i])out.push(point(i));out.push(point(start));return out.reverse();
  }
  window.DuoPhysics={segmentRect,segmentCircle,clear,path};
})();
