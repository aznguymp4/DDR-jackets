# From: https://github.com/SaxxonPike/rhythm-game-formats/blob/master/ddr/ssq.md

# Dance Dance Revolution SSQ Format

This document serves to explain the SSQ format used by Konami's Dance Dance
Revolution series of video games.

## About this format

To date, SSQ is the most recent format used by Konami's Dance Dance Revolution
series. Its earliest occurrence is in unreferenced files in DDR 3rd Mix Plus.
They are first officially used in DDR 4th Mix.

SSQ appears to have been originally developed without freeze notes in mind.
The reasoning is how early the format has been found and the hacky way it
was implemented. Shock arrows are also implemented in a hacky way, although
in a less intrusive manner (see below.)

It supports BPM changes and multiple variable sized chunks, much like a WAV
file.

There is no indication how long an SSQ file actually is. The typical method is
to keep reading until a value of zero is read for the length. Thus, each
SSQ file ends with four 0x00 bytes.

Chunks are `dword` aligned, meaning if the data length is not a multiple of
four before being written, it is padded up to the next multiple of four.

## In a nutshell

SSQ is a series of "chunks". Each chunk has a header describing what it is
along with some chunk-specific metadata.

Often, you'll find at least three chunks. They are the tempo data, some
unknown yet consistent data, and the note data. One chunk exists per chart
difficulty. Additional data is likely video scripting data; see below for
details.

## Chunk format

```
Offset(h) Type      Length    Descrption
+00       int32     4         length of the data in bytes including this header
+04       int16     2         parameter 1: type of chunk
+06       int16     2         parameter 2: type-dependent metadata
+08       int16     2         parameter 3: type-dependent metadata
+0A       int16     2         parameter 4: type-dependent metadata
+0C       ?         ?         the rest of the data
```

## Chunk types

The format changes depending on parameter 1 found above. Data will have all its
time offsets first, then all its corresponding data second.

### Type 01: tempo changes

- Parameter 2: Time frames per second
- Parameter 3: Number of BPM change/stop entries

After the time offsets, tempo data is `int32` type and will be 4 bytes per
entry. The time offset determines what point the song needs to change tempo
or stop, and the data determines how many time frames are supposed to have
passed.

You can use the following formula to convert this kind of time table into BPM.
Note that `i` must be at least 1 because deltas are used.

```
DeltaOffset = TimeOffset[i] - TimeOffset[i - 1];
DeltaTicks = TempoData[i] - TempoData[i - 1];
TicksPerSecond = Parameter2;
MeasureLength = 4096;

BPM = (DeltaOffset / MeasureLength) / ((DeltaTicks / TicksPerSecond) / 240);
```

Stops will be encoded as two consecutive entries with the same time offset, but
different data. You can use the following formula to convert this kind of
time into seconds.

```
DeltaTicks = TempoData[i] - TempoData[i - 1];
TicksPerSecond = Parameter2;

StopLengthInSeconds = DeltaTicks / TicksPerSecond;
```

### Type 02: unknown

- Parameter 3: Number of entries

After the time offsets, this data is `int16` type and will be 2 bytes per
entry. Not much else is known about this chunk type. It appears in every
observed SSQ file so far. It could possibly be linked to what tells the game
when to end the song and show the results screen.

The observed pattern in hex:
```
0104
0201
0202
0205
0203
0204
```

### Type 03: steps

- Parameter 2: Chart difficulty type
- Parameter 3: Number of steps

After the time offsets, this data is `byte` type and will be at least one byte
per entry (see below for details about why this varies.)

#### Difficulty types

Use Parameter 2 with the following table to determine the chart type.

```
Value(h)  Type
0114      Single Basic
0214      Single Standard
0314      Single Heavy
0414      Single Beginner
0614      Single Challenge

0118      Double Basic
0218      Double Standard
0318      Double Heavy
0418      Double Beginner
0618      Double Challenge
```

#### Decoding steps

Each arrow is represented by one bit of the data. Assuming the least
significant bit is 0, and the most significant bit is 7, you can use this table
to determine which arrow is to be pressed:

```
Bit       Arrow
0         Player 1 Left
1         Player 1 Down
2         Player 1 Up
3         Player 1 Right
4         Player 2 Left
5         Player 2 Down
6         Player 2 Up
7         Player 2 Right
```

#### Decoding shock arrows

As of DDR X, shock arrows are part of the format, and are indicated
by having all bits set (a value of 0xFF).

#### Decoding freeze arrows

On DDR MAX and later mixes, it is possible to encounter data where the step
data has no bits set (0x00). This indicates a special kind of arrow, such as
a freeze. This special arrow data is present after all the normal data.

The start of this data is dword-aligned after the end of all the normal
step data above.

Each time a value of `0x00` is encountered in the step data, it corresponds
to a two-byte structure in the tacked-on extra data:

```
Offset(h) Type      Length    Descrption
+00       byte      1         panels for the extra data
+01       byte      1         type of the extra data
```

For freezes, the type should be `0x01`, and the panel data represents which
panels are to be interpreted as starting a freeze.

### Type 04: background change script

No parameters are known about this chunk type. It exists here for speculation
only.

### Type 09: song metadata

This section contains at least the title and artist of a song. This kind of chunk was discovered by looking at Dance Dance Revolution S+. Further details pending for this section.
