import React from 'react'
import { View, Text } from 'react-native'
import { styled } from 'nativewind'
import { RotateCcw } from 'lucide-react-native'
import {
  describeRelativeDay,
  formatSetChip,
  hasSetData,
  resolveSetForNumber,
  type LastSession,
} from '../../utils/lastSession'

const StyledView = styled(View)
const StyledText = styled(Text)

interface LastSessionPanelProps {
  session: LastSession | null
  // The set the user is about to perform — its chip is highlighted.
  currentSet: number
  todayKey: string
}

const LastSessionPanel: React.FC<LastSessionPanelProps> = ({
  session,
  currentSet,
  todayKey,
}) => {
  // Nothing to compare against yet (new exercise, or first ever session).
  if (!session) return null

  const sets = session.sets.filter(hasSetData)
  if (sets.length === 0) return null

  // The chips carry the numbers, so the upcoming set is only marked — not
  // repeated as a separate headline above them.
  const target = resolveSetForNumber({ ...session, sets }, currentSet)

  return (
    <StyledView
      testID="last-session-panel"
      className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl px-3 py-2">
      <StyledView className="flex-row justify-between items-center mb-1.5">
        <StyledView className="flex-row items-center flex-1 mr-2">
          <RotateCcw color="#71717a" size={11} />
          <StyledText className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1.5">
            Last Time
          </StyledText>
          {!!target?.variant && (
            <StyledText
              className="text-[10px] font-bold text-indigo-400 ml-1.5"
              numberOfLines={1}>
              · {target.variant}
            </StyledText>
          )}
        </StyledView>
        <StyledText
          testID="last-session-when"
          className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          {describeRelativeDay(session.dateKey, todayKey)}
        </StyledText>
      </StyledView>

      <StyledView className="flex-row flex-wrap gap-1.5">
        {sets.map((set) => {
          const active = set.set === target?.set
          return (
            <StyledView
              key={set.id}
              testID={`last-session-chip-${set.set}`}
              // Marks the upcoming set for screen readers, since the
              // highlight is the only thing distinguishing it visually.
              accessibilityState={{ selected: active }}
              className={`flex-row items-center rounded-lg px-2 py-0.5 ${
                active
                  ? 'bg-indigo-600/20 border border-indigo-500/60'
                  : 'bg-zinc-950 border border-zinc-800'
              }`}>
              <StyledText
                className={`text-[10px] font-black mr-1 ${
                  active ? 'text-indigo-300' : 'text-zinc-600'
                }`}>
                {set.set}
              </StyledText>
              <StyledText
                className={`text-xs font-bold ${
                  active ? 'text-white' : 'text-zinc-400'
                }`}>
                {formatSetChip(set)}
              </StyledText>
            </StyledView>
          )
        })}
      </StyledView>
    </StyledView>
  )
}

export default React.memo(LastSessionPanel)
