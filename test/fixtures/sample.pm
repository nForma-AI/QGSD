dtmc
const double tp_rate;
const int max_rounds = 9;
module Main
  s : [0..2] init 0;
  [step] s=0 -> tp_rate : (s'=1) + (1-tp_rate) : (s'=2);
endmodule
