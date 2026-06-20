import React from 'react'
import { render } from '@testing-library/react-native'
import StyledText from '../StyledText'

describe('StyledText', () => {
  it('renders correctly with given text', () => {
    const { getByText } = render(<StyledText>Hello World</StyledText>)
    expect(getByText('Hello World')).toBeTruthy()
  })

  it('passes down props correctly', () => {
    const { getByTestId } = render(
      <StyledText testID="styled-text" accessibilityLabel="Test Label">
        Testing Props
      </StyledText>
    )
    const element = getByTestId('styled-text')
    expect(element).toBeTruthy()
    expect(element.props.accessibilityLabel).toBe('Test Label')
  })
})
